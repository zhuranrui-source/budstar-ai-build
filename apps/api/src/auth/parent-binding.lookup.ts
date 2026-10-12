export const PARENT_BINDING_LOOKUP = Symbol('PARENT_BINDING_LOOKUP');

export type ParentBindingLookup = {
  listActiveStudentIds(parentProfileId: string): Promise<string[]>;
};
