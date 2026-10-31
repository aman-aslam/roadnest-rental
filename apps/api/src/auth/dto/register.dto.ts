import { IsEmail, IsOptional, IsString, Matches, MinLength } from 'class-validator';
export class RegisterDto {
  @IsString() name!: string;
  @IsOptional() @IsEmail() email?: string;
  @IsOptional() @Matches(/^\+?[0-9]{10,15}$/) phone?: string;
  @IsString() @MinLength(10) password!: string;
}
