import { IsDateString, IsOptional, IsString } from 'class-validator';
export class CreateBookingDto {
  @IsString() vehicleId!: string;
  @IsDateString() pickupAt!: string;
  @IsDateString() returnAt!: string;
  @IsOptional() @IsString() pickupLocation?: string;
  @IsOptional() @IsString() returnLocation?: string;
  @IsOptional() @IsString() notes?: string;
}
