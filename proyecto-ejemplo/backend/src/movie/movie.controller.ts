import { Body, Controller, Get, Post } from '@nestjs/common';
import { MovieService } from './movie.service';
import { ApiOperation, ApiResponse } from '@nestjs/swagger';
import { CreateMovieDto } from './dto/ create-movie.dto';

@Controller('movie')
export class MovieController {
  constructor(private readonly movieService: MovieService) {}

  @Get()
  @ApiOperation({ summary: 'Obtener todos las películas' })
  @ApiResponse({ status: 200, description: 'Películas obtenidas exitosamente' })
  async findAll() {
    return this.movieService.findAll();
  }

  @Post()
  @ApiOperation({ summary: 'Crear una nueva película' })
  @ApiResponse({ status: 201, description: 'Película creada exitosamente' })
  async create(
    @Body() createMovieDto: CreateMovieDto
  ) {
    return this.movieService.create(createMovieDto);
  }
}
