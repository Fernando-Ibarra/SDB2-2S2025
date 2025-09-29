import { ApiProperty } from "@nestjs/swagger";
import { IsNumber, IsString } from "class-validator";

export class CreateMovieDto {

    @ApiProperty({ 
        example: 'Inception', 
        description: 'Título de la película' 
    })
    @IsString()
    title: string;

    @ApiProperty({
        example: 'A mind-bending thriller by Christopher Nolan',
        description: 'Descripción de la película'
    })
    @IsString()
    description: string;

    @ApiProperty({
        example: 2010,
        description: 'Año de lanzamiento de la película'
    })
    @IsNumber()
    release_year: number;

}
