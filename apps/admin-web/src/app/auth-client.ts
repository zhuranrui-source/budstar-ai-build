import type {
  AdminPlanetCommentView,
  AdminPlanetPostView,
  AuthenticatedSession,
} from '@budstar/contracts';

const SESSION_KEY = 'budstar.admin.session';

type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
type FetchLike = (
  input: string | URL | Request,
  init?: RequestInit,
) => Promise<Response>;

export class ApiRequestError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

export class SessionExpiredError extends ApiRequestError {
  constructor() {
    super(401, 'UNAUTHORIZED', '登录状态已过期，请重新登录');
  }
}

export class ForbiddenError extends ApiRequestError {
  constructor(message = '无权执行该操作') {
    super(403, 'FORBIDDEN', message);
  }
}

export class AdminApiClient {
  constructor(
    private readonly baseUrl: string,
    // 浏览器要求 fetch 以 window 为接收者调用；直接存为属性再 this.fetcher() 会抛 Illegal invocation。
    private readonly fetcher: FetchLike = (input, init) => fetch(input, init),
    private readonly storage: StorageLike = typeof window === 'undefined'
      ? {
          getItem: () => null,
          setItem: () => undefined,
          removeItem: () => undefined,
        }
      : window.sessionStorage,
  ) {}

  async login(
    kind: 'staff' | 'partner' | 'platform',
    loginIdentifier: string,
    password: string,
  ): Promise<AuthenticatedSession> {
    const session = await this.publicRequest<AuthenticatedSession>(
      `/auth/${kind}/login`,
      { loginIdentifier, password },
    );
    this.writeSession(session);
    return session;
  }

  /** 统一入口：后端按账号识别员工或平台管理员。 */
  async adminLogin(
    loginIdentifier: string,
    password: string,
  ): Promise<AuthenticatedSession> {
    const session = await this.publicRequest<AuthenticatedSession>(
      '/auth/admin/login',
      { loginIdentifier, password },
    );
    this.writeSession(session);
    return session;
  }

  // ===== 星芽星球 =====

  async uploadPlanetImage(image: Blob): Promise<{ url: string }> {
    return this.authenticatedRequest('/planet/images', undefined, {
      method: 'POST',
      body: image,
      headers: { 'Content-Type': 'image/jpeg' },
    });
  }

  async listPlanetPosts(status?: string): Promise<AdminPlanetPostView[]> {
    return this.authenticatedRequest(
      `/admin/planet/posts${status ? `?status=${status}` : ''}`,
    );
  }

  async createPlanetPost(input: {
    category: string;
    title: string;
    body: string;
    imageUrls: string[];
    studentInitial?: string;
    guardianConsent: boolean;
    pinned: boolean;
  }): Promise<AdminPlanetPostView> {
    return this.authenticatedRequest('/admin/planet/posts', undefined, {
      method: 'POST',
      body: JSON.stringify(input),
    });
  }

  async updatePlanetPost(
    id: string,
    patch: { status?: string; pinned?: boolean },
  ): Promise<AdminPlanetPostView> {
    return this.authenticatedRequest(`/admin/planet/posts/${id}`, undefined, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    });
  }

  async listPlanetComments(status?: string): Promise<AdminPlanetCommentView[]> {
    return this.authenticatedRequest(
      `/admin/planet/comments${status ? `?status=${status}` : ''}`,
    );
  }

  async updatePlanetComment(id: string, status: string) {
    return this.authenticatedRequest<{ id: string; status: string }>(
      `/admin/planet/comments/${id}`,
      undefined,
      { method: 'PATCH', body: JSON.stringify({ status }) },
    );
  }

  async listConsumerAccounts() {
    return this.authenticatedRequest<
      Array<{ id: string; username: string; updatedAt: string }>
    >('/platform/consumer-accounts');
  }

  async assignConsumerAccount(body: {
    phone: string;
    username: string;
    password: string;
  }) {
    return this.authenticatedRequest<{
      userAccountId: string;
      username: string;
    }>('/platform/consumer-accounts', undefined, {
      method: 'POST',
      body: JSON.stringify(body),
    });
  }

  async getCampusOverview(campusId: string) {
    return this.authenticatedRequest<{
      campusId: string;
      roles: string[];
      modules: string[];
    }>('/admin/overview', campusId);
  }

  async listClasses(campusId: string) {
    return this.authenticatedRequest<
      Array<{
        id: string;
        name: string;
        classCode: string;
        status: string;
        coursePackageTitle: string;
        coursePackageVersion: string;
        studentCount: number;
      }>
    >('/admin/classes', campusId);
  }

  async createClass(
    campusId: string,
    body: { name: string; coursePackageVersionId: string },
  ) {
    return this.authenticatedRequest('/admin/classes', campusId, {
      method: 'POST',
      body: JSON.stringify(body),
    });
  }

  async updateClass(
    campusId: string,
    classId: string,
    body: { name?: string; status?: string },
  ) {
    return this.authenticatedRequest(`/admin/classes/${classId}`, campusId, {
      method: 'PATCH',
      body: JSON.stringify(body),
    });
  }

  async listClassStudents(campusId: string, classId: string) {
    return this.authenticatedRequest<
      Array<{
        studentProfileId: string;
        displayName: string;
        joinedAt: string;
      }>
    >(`/admin/classes/${classId}/students`, campusId);
  }

  async listStudents(campusId: string) {
    return this.authenticatedRequest<
      Array<{
        id: string;
        displayName: string;
        hasFamilyViewCode: boolean;
        familyViewCodeUpdatedAt: string | null;
        activeBindingCount: number;
      }>
    >('/admin/students', campusId);
  }

  async createStudent(campusId: string, body: { displayName: string }) {
    return this.authenticatedRequest<{
      studentProfileId: string;
      displayName: string;
      familyViewCode: string;
      updatedAt: string;
    }>('/admin/students', campusId, {
      method: 'POST',
      body: JSON.stringify(body),
    });
  }

  async resetFamilyViewCode(campusId: string, studentProfileId: string) {
    return this.authenticatedRequest<{
      studentProfileId: string;
      familyViewCode: string;
      updatedAt: string;
    }>(`/admin/students/${studentProfileId}/family-view-code/reset`, campusId, {
      method: 'POST',
      body: '{}',
    });
  }

  async listFamilyBindings(campusId: string) {
    return this.authenticatedRequest<
      Array<{
        id: string;
        studentDisplayName: string;
        studentProfileId: string;
        status: string;
        updatedAt: string;
      }>
    >('/admin/family-bindings', campusId);
  }

  async revokeFamilyBinding(campusId: string, bindingId: string) {
    return this.authenticatedRequest(
      `/admin/family-bindings/${bindingId}/revoke`,
      campusId,
      { method: 'POST', body: '{}' },
    );
  }

  async createObjectStoragePresign(
    campusId: string,
    body: {
      fileName: string;
      contentType: string;
      contentLength: number;
      purpose?: string;
    },
  ) {
    return this.authenticatedRequest<{
      uploadUrl: string;
      objectKey: string;
      accessUrl: string;
      expiresAt: string;
      retryable: true;
    }>('/object-storage/presign', campusId, {
      method: 'POST',
      body: JSON.stringify(body),
    });
  }

  async listPublishedCoursePackages(campusId: string) {
    return this.authenticatedRequest<
      Array<{
        id: string;
        title: string;
        version: string;
        packageKey: string;
      }>
    >('/admin/course-packages/published', campusId);
  }

  async listSubmissions(
    campusId: string,
    query: { status?: string; classId?: string } = {},
  ) {
    const params = new URLSearchParams();
    if (query.status) params.set('status', query.status);
    if (query.classId) params.set('classId', query.classId);
    const suffix = params.toString() ? `?${params}` : '';
    return this.authenticatedRequest<
      Array<{
        id: string;
        className: string;
        studentDisplayName: string;
        lessonTitle: string;
        lessonSequence: number;
        track: string;
        status: string;
        title: string;
        updatedAt: string;
        submittedAt: string | null;
      }>
    >(`/admin/submissions${suffix}`, campusId);
  }

  async getSubmission(campusId: string, submissionId: string) {
    return this.authenticatedRequest<{
      id: string;
      className: string;
      studentDisplayName: string;
      lessonTitle: string;
      lessonSequence: number;
      track: string;
      status: string;
      title: string;
      content: Record<string, unknown>;
      updatedAt: string;
      submittedAt: string | null;
    }>(`/admin/submissions/${submissionId}`, campusId);
  }

  async transitionSubmission(
    campusId: string,
    submissionId: string,
    body: { toStatus: string; note?: string },
  ) {
    return this.authenticatedRequest(
      `/admin/submissions/${submissionId}/transitions`,
      campusId,
      { method: 'POST', body: JSON.stringify(body) },
    );
  }

  async generateFeedbackDraft(campusId: string, workSubmissionId: string) {
    return this.authenticatedRequest<{
      id: string;
      status: string;
      content: string;
    }>('/admin/feedback/drafts/generate', campusId, {
      method: 'POST',
      body: JSON.stringify({ workSubmissionId }),
    });
  }

  async saveFormalFeedback(
    campusId: string,
    body: {
      workSubmissionId: string;
      body: string;
      highlights?: string[];
      nextSteps?: string[];
      aiDraftId?: string;
    },
  ) {
    return this.authenticatedRequest<{
      id: string;
      status: string;
      version: number;
    }>('/admin/feedback/formal', campusId, {
      method: 'PUT',
      body: JSON.stringify(body),
    });
  }

  async publishFormalFeedback(campusId: string, formalFeedbackId: string) {
    return this.authenticatedRequest<{ id: string; status: string }>(
      `/admin/feedback/formal/${formalFeedbackId}/publish`,
      campusId,
      { method: 'POST', body: '{}' },
    );
  }

  async getLessonReportCopy(campusId: string, formalFeedbackId: string) {
    return this.authenticatedRequest<{
      wechatCopy: string;
      structured: {
        lessonTitle: string;
        body: string;
        highlights: string[];
        nextSteps: string[];
      };
    }>(`/admin/feedback/formal/${formalFeedbackId}/lesson-report`, campusId);
  }

  async generateFiveDim(campusId: string, workSubmissionId: string) {
    return this.authenticatedRequest<{
      id: string;
      status: string;
      scores: Array<{ dimension: string; level: number; rationale: string }>;
    }>('/admin/feedback/five-dim/generate', campusId, {
      method: 'POST',
      body: JSON.stringify({ workSubmissionId }),
    });
  }

  async reviewFiveDim(
    campusId: string,
    evaluationId: string,
    action: 'mark_review' | 'confirm',
  ) {
    return this.authenticatedRequest<{ id: string; status: string }>(
      `/admin/feedback/five-dim/${evaluationId}/review`,
      campusId,
      { method: 'POST', body: JSON.stringify({ action }) },
    );
  }

  async generateGrowthReport(
    campusId: string,
    body: {
      studentProfileId: string;
      classId: string;
      milestone: 4 | 8 | 12 | 16;
    },
  ) {
    return this.authenticatedRequest<{ id: string; status: string }>(
      '/admin/growth/reports/generate',
      campusId,
      { method: 'POST', body: JSON.stringify(body) },
    );
  }

  async publishGrowthReport(
    campusId: string,
    reportId: string,
    teacherObservation?: string,
  ) {
    return this.authenticatedRequest<{ id: string; status: string }>(
      `/admin/growth/reports/${reportId}/publish`,
      campusId,
      {
        method: 'POST',
        body: JSON.stringify(teacherObservation ? { teacherObservation } : {}),
      },
    );
  }

  async listModerationQueue(campusId: string) {
    return this.authenticatedRequest<
      Array<{
        id: string;
        campusId: string;
        classId: string | null;
        studentProfileId: string;
        studentDisplayName: string;
        title: string;
        body: string;
        visibilityScope: string;
        riskLevel: string;
        status: string;
        publishedAt: string | null;
        createdAt: string;
      }>
    >('/admin/community/moderation', campusId);
  }

  async reviewCommunityPost(
    campusId: string,
    postId: string,
    body: { action: 'approve' | 'reject' | 'hide'; note?: string },
  ) {
    return this.authenticatedRequest<{
      id: string;
      status: string;
      riskLevel: string;
    }>(`/admin/community/posts/${postId}/review`, campusId, {
      method: 'POST',
      body: JSON.stringify(body),
    });
  }

  async listAppointmentLeads(
    campusId: string,
    query: {
      status?: string;
      q?: string;
      source?: 'OFFICIAL_SITE' | 'REFERRAL' | 'OFFLINE' | 'PARTNER' | 'OTHER';
      overdue?: 'true' | 'false';
    } = {},
  ) {
    const params = new URLSearchParams();
    if (query.status) params.set('status', query.status);
    if (query.q) params.set('q', query.q);
    const suffix = params.toString() ? `?${params}` : '';
    return this.authenticatedRequest<
      Array<{
        id: string;
        parentName: string;
        phoneMasked: string;
        childAgeOrGrade: string;
        interestedCourse: string;
        preferredContactTime: string;
        status: string;
        assigneeAccountId: string | null;
        note: string | null;
        source: string | null;
        nextContactAt: string | null;
        createdAt: string;
      }>
    >(`/admin/appointment-leads${suffix}`, campusId);
  }

  async getLeadFunnel(
    campusId: string,
    range?: { from?: string; to?: string },
  ): Promise<{
    stages: Array<{ status: string; count: number; overdue: number }>;
    conversionRates: Array<{ from: string; to: string; rate: number }>;
  }> {
    const params = new URLSearchParams();
    if (range?.from) params.set('from', range.from);
    if (range?.to) params.set('to', range.to);
    const suffix = params.toString() ? `?${params}` : '';
    return this.authenticatedRequest(
      `/admin/appointment-leads/funnel${suffix}`,
      campusId,
    );
  }

  async getLeadTrend(
    campusId: string,
    days = 14,
  ): Promise<Array<{ date: string; count: number }>> {
    return this.authenticatedRequest(
      `/admin/appointment-leads/trend?days=${days}`,
      campusId,
    );
  }

  async getLeadPhone(
    campusId: string,
    leadId: string,
  ): Promise<{ phone: string }> {
    return this.authenticatedRequest(
      `/admin/appointment-leads/${leadId}/phone`,
      campusId,
    );
  }

  async updateAppointmentLead(
    campusId: string,
    leadId: string,
    body: {
      assigneeAccountId?: string | null;
      note?: string | null;
      source?: string;
      nextContactAt?: string | null;
    },
  ) {
    return this.authenticatedRequest(
      `/admin/appointment-leads/${leadId}`,
      campusId,
      { method: 'PATCH', body: JSON.stringify(body) },
    );
  }

  async transitionAppointmentLead(
    campusId: string,
    leadId: string,
    body: { toStatus: string; note?: string; reopenReason?: string },
  ) {
    return this.authenticatedRequest(
      `/admin/appointment-leads/${leadId}/transitions`,
      campusId,
      { method: 'POST', body: JSON.stringify(body) },
    );
  }

  async getAppointmentLeadHistory(campusId: string, leadId: string) {
    return this.authenticatedRequest<
      Array<{
        id: string;
        fromStatus: string | null;
        toStatus: string;
        changedAt: string;
        note: string | null;
      }>
    >(`/admin/appointment-leads/${leadId}/history`, campusId);
  }

  async selectCampus(campusId: string) {
    return this.authenticatedRequest<{ campusId: string; selected: true }>(
      '/admin/campus-context',
      campusId,
      { method: 'POST', body: JSON.stringify({ campusId }) },
    );
  }

  async getPlatformOverview() {
    return this.authenticatedRequest<{ scope: 'platform'; modules: string[] }>(
      '/platform/overview',
    );
  }

  async logout(): Promise<void> {
    const session = this.readSession();
    this.clearSession();
    if (!session) return;
    try {
      await this.fetcher(`${this.baseUrl}/auth/logout`, {
        method: 'POST',
        credentials: 'include',
        headers: { Authorization: `Bearer ${session.accessToken}` },
      });
    } catch {
      // Local logout is authoritative even when the network is unavailable.
    }
  }

  readSession(): AuthenticatedSession | null {
    const raw = this.storage.getItem(SESSION_KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as AuthenticatedSession;
    } catch {
      this.clearSession();
      return null;
    }
  }

  clearSession(): void {
    this.storage.removeItem(SESSION_KEY);
  }

  async restoreSession(): Promise<AuthenticatedSession | null> {
    const stored = this.readSession();
    if (!stored) return null;
    try {
      const response = await this.fetchWithSession('/auth/session', stored);
      const verified = await this.readResponse<AuthenticatedSession>(response);
      this.writeSession(verified);
      return verified;
    } catch (error) {
      if (error instanceof ApiRequestError && error.status === 401) {
        try {
          const refreshed = await this.refresh();
          const response = await this.fetchWithSession(
            '/auth/session',
            refreshed,
          );
          return await this.readResponse<AuthenticatedSession>(response);
        } catch {
          this.clearSession();
          return null;
        }
      }
      if (!(error instanceof ForbiddenError)) this.clearSession();
      throw error;
    }
  }

  private async publicRequest<T>(path: string, body: unknown): Promise<T> {
    const response = await this.fetcher(`${this.baseUrl}${path}`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    return this.readResponse<T>(response);
  }

  private async authenticatedRequest<T>(
    path: string,
    campusId?: string,
    init: RequestInit = {},
  ): Promise<T> {
    let session = this.readSession();
    if (!session) throw new SessionExpiredError();
    let response = await this.fetchWithSession(path, session, campusId, init);
    if (response.status === 401) {
      session = await this.refresh();
      response = await this.fetchWithSession(path, session, campusId, init);
    }
    if (response.status === 401) {
      this.clearSession();
      throw new SessionExpiredError();
    }
    return this.readResponse<T>(response);
  }

  private fetchWithSession(
    path: string,
    session: AuthenticatedSession,
    campusId?: string,
    init: RequestInit = {},
  ) {
    return this.fetcher(`${this.baseUrl}${path}`, {
      ...init,
      credentials: 'include',
      headers: {
        ...(init.body ? { 'Content-Type': 'application/json' } : {}),
        Authorization: `Bearer ${session.accessToken}`,
        ...(campusId ? { 'X-Campus-Id': campusId } : {}),
        ...init.headers,
      },
    });
  }

  private async refresh(): Promise<AuthenticatedSession> {
    const response = await this.fetcher(`${this.baseUrl}/auth/refresh`, {
      method: 'POST',
      credentials: 'include',
    });
    if (!response.ok) {
      this.clearSession();
      throw new SessionExpiredError();
    }
    const session = (await response.json()) as AuthenticatedSession;
    this.writeSession(session);
    return session;
  }

  private writeSession(session: AuthenticatedSession): void {
    this.storage.setItem(SESSION_KEY, JSON.stringify(session));
  }

  private async readResponse<T>(response: Response): Promise<T> {
    const body = (await response.json()) as {
      code?: string;
      message?: string;
    };
    if (!response.ok) {
      if (response.status === 403) {
        throw new ForbiddenError(body.message);
      }
      throw new ApiRequestError(
        response.status,
        body.code ?? 'INTERNAL_ERROR',
        body.message ?? '请求失败',
      );
    }
    return body as T;
  }
  // ===== 合作方内容门户（ADR-0009：仅已发布内容，零学生数据） =====

  async getPartnerCourses(): Promise<
    Array<{ id: string; title: string; mainLessonCount?: number }>
  > {
    return this.authenticatedRequest('/partner/content/courses');
  }

  async getPartnerSubjectCourses(): Promise<
    Array<{
      id: string;
      subject: string;
      gradeBand: string;
      gradeLevel: number | null;
      title: string;
      chapterCount: number;
    }>
  > {
    return this.authenticatedRequest('/partner/content/subject-courses');
  }

  // ===== 学科内容库（平台治理；ADR-0009 内容只对合作方/家庭只读发布） =====

  async listSubjectCourses(): Promise<
    Array<{
      id: string;
      subject: string;
      gradeBand: string;
      gradeLevel: number;
      title: string;
      status: string;
      publishedAt: string | null;
      chapterCount: number;
    }>
  > {
    return this.authenticatedRequest('/platform/subject-courses');
  }

  async createSubjectCourse(input: {
    subject: string;
    gradeBand: string;
    gradeLevel: number;
    title: string;
    chapters: Array<{
      sequence: number;
      title: string;
      contentHtml: string;
      aiGuidePrompt?: string;
    }>;
  }) {
    return this.authenticatedRequest('/platform/subject-courses', undefined, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
  }

  async getSubjectCourse(id: string): Promise<{
    id: string;
    title: string;
    subject: string;
    gradeBand: string;
    gradeLevel: number | null;
    status: string;
    chapters: Array<{
      id: string;
      sequence: number;
      title: string;
      contentUrl: string | null;
      aiContext: string | null;
    }>;
  }> {
    return this.authenticatedRequest(`/platform/subject-courses/${id}`);
  }

  async publishSubjectCourse(id: string) {
    return this.authenticatedRequest(
      `/platform/subject-courses/${id}/publish`,
      undefined,
      { method: 'POST' },
    );
  }
}
