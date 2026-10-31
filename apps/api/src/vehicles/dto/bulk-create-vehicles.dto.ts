import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsArray, ValidateNested } from 'class-validator';
import { CreateVehicleDto } from './create-vehicle.dto';

export class BulkCreateVehiclesDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => CreateVehicleDto)
  vehicles!: CreateVehicleDto[];
}
