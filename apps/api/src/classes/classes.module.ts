import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { PrismaService } from '../database/prisma.service';
import { ClassesController } from './classes.controller';
import {
  ClassesService,
  InMemoryClassStore,
  type ClassStore,
} from './classes.service';
import { PrismaClassStore } from './prisma-class.store';

export const CLASS_STORE = Symbol('CLASS_STORE');

@Module({
  imports: [DatabaseModule],
  controllers: [ClassesController],
  providers: [
    {
      provide: CLASS_STORE,
      useFactory: (prisma: PrismaService): ClassStore => {
        if (process.env.CLASS_STORE === 'memory') {
          return new InMemoryClassStore();
        }
        if (!process.env.DATABASE_URL) {
          if (process.env.NODE_ENV === 'production') {
            throw new Error(
              'DATABASE_URL is required for class persistence in production',
            );
          }
          return new InMemoryClassStore();
        }
        return new PrismaClassStore(prisma);
      },
      inject: [PrismaService],
    },
    {
      provide: ClassesService,
      useFactory: (store: ClassStore) => new ClassesService(store),
      inject: [CLASS_STORE],
    },
  ],
  exports: [ClassesService],
})
export class ClassesModule {}
