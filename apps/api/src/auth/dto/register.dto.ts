import { Transform } from 'class-transformer';
import { IsEmail, IsOptional, IsString, Matches, MinLength } from 'class-validator';

export class RegisterDto {
  @IsString()
  name!: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @Transform(({ value }) => typeof value === 'string' ? value.replace(/[\s()-]/g, '') : value)
  @Matches(/^\+?[0-9]{10,15}$/, {
    message: 'phone must contain 10–15 digits, optionally prefixed with + country code.',
  })
  phone?: string;

  @IsString()
  @MinLength(10)
  password!: string;
}
