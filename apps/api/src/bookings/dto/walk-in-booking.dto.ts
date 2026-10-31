import { IsDateString, IsOptional, IsString, Matches } from 'class-validator';
export class WalkInBookingDto {
  @IsString() vehicleId!: string;
  @IsString() customerName!: string;
  @Matches(/^\+?[0-9]{10,15}$/) customerPhone!: string;
  @IsOptional() @IsString() customerEmail?: string;
  @IsDateString() pickupAt!: string;
  @IsDateString() returnAt!: string;
  @IsOptional() @IsString() notes?: string;
  @IsOptional() @IsString() paymentMethod?: 'CASH'|'UPI'|'CARD'|'BANK_TRANSFER';
  @IsOptional() @IsString() advanceAmount?: string;
}
