import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Roles } from '../common/roles.decorator';
import { RolesGuard } from '../common/roles.guard';
import { ReportsService } from './reports.service';

@Controller('reports')
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles('ADMIN','STAFF')
export class ReportsController {
  constructor(private reports: ReportsService) {}
  @Get('dashboard') dashboard() { return this.reports.dashboard(); }
  @Get('revenue') revenue(@Query('from') from?: string, @Query('to') to?: string) { return this.reports.revenue(from, to); }
  @Get('expenses') expenses() { return this.reports.expenses(); }
  @Post('expenses') addExpense(@Body() body: any) { return this.reports.addExpense(body); }
}
