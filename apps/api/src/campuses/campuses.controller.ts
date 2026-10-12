import { Controller, Get, Inject } from '@nestjs/common';
import {
  CAMPUS_REPOSITORY,
  type CampusRepository,
  type PublicCampus,
} from './campus.repository';
import { Public } from '../authorization/authorization.decorators';

@Controller('public/campuses')
@Public()
export class CampusesController {
  constructor(
    @Inject(CAMPUS_REPOSITORY)
    private readonly campuses: CampusRepository,
  ) {}

  @Get()
  list(): Promise<PublicCampus[]> {
    return this.campuses.listPublic();
  }
}
