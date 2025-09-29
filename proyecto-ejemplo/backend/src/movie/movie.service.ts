import { Injectable } from '@nestjs/common';
import { DatabaseService } from 'src/common/database/database.service';
import { CreateMovieDto } from './dto/ create-movie.dto';

@Injectable()
export class MovieService {

    constructor(private readonly db: DatabaseService) {}

    async create(createMovieDto: CreateMovieDto) {
        const { title, description, release_year } = createMovieDto;
        const result = await this.db.query(
            'INSERT INTO movies (title, description, release_year) VALUES ($1, $2, $3) RETURNING *',
            [title, description, release_year]
        );
        return result.rows[0];
    }

    async findAll() {
        const result = await this.db.query('SELECT * FROM movies');
        return result.rows;
    }
}
