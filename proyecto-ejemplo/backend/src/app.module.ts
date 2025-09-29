import { Module } from '@nestjs/common';
import { MovieModule } from './movie/movie.module';
import { DatabaseModule } from './common/database/database.module';

@Module({
  imports: [DatabaseModule, MovieModule],
  controllers: [],
  providers: [],
})
export class AppModule {}
