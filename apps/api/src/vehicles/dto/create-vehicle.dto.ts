import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class CreateVehicleDto {
  @IsIn(['CAR', 'BIKE'])
  type!: 'CAR' | 'BIKE';

  @IsIn(['HATCHBACK', 'SEDAN', 'SUV', 'MPV', 'LUXURY', 'SPORTS_BIKE', 'SCOOTER', 'MOTORCYCLE', 'ELECTRIC_BIKE'])
  category!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(80)
  brand!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(80)
  model!: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  variant?: string;

  @IsString()
  @MinLength(1)
  @MaxLength(120)
  displayName!: string;

  @IsString()
  @MinLength(5)
  @MaxLength(20)
  @Matches(/^[A-Za-z0-9 -]+$/, { message: 'registrationNumber may contain only letters, numbers, spaces and hyphens.' })
  registrationNumber!: string;

  @IsOptional()
  @IsInt()
  @Min(1900)
  @Max(2100)
  year?: number;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  color?: string;

  @IsIn(['PETROL', 'DIESEL', 'ELECTRIC', 'HYBRID', 'CNG'])
  fuelType!: string;

  @IsOptional()
  @IsIn(['MANUAL', 'AUTOMATIC'])
  transmission?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  seats?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10000)
  engineCc?: number;

  @IsOptional()
  @IsBoolean()
  isElectric?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  rangeKm?: number;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(30)
  @IsString({ each: true })
  features?: string[];

  @IsOptional()
  @IsInt()
  @Min(0)
  hourlyRatePaise?: number;

  @IsInt()
  @Min(0)
  dailyRatePaise!: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  weeklyRatePaise?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  monthlyRatePaise?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  securityDepositPaise?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  includedKmPerDay?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  extraKmRatePaise?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  lateFeePerHourPaise?: number;

  @IsString()
  @MinLength(1)
  @MaxLength(160)
  pickupLocation!: string;

  @IsOptional()
  @IsBoolean()
  isFeatured?: boolean;

  @IsOptional()
  @IsBoolean()
  isPublished?: boolean;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(8)
  @IsString({ each: true })
  images?: string[];
}
