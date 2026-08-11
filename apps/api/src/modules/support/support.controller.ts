import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthTokenPayload } from '../auth/auth.service';
import { SupportService } from './support.service';
import { CreateSupportTicketDto } from './dto/create-support-ticket.dto';

@Controller('support')
@UseGuards(JwtAuthGuard)
export class SupportController {
  constructor(private readonly support: SupportService) {}

  @Get('tickets')
  list(@CurrentUser() user: AuthTokenPayload) {
    return this.support.listForUser(user.sub);
  }

  @Post('tickets')
  create(@CurrentUser() user: AuthTokenPayload, @Body() dto: CreateSupportTicketDto) {
    return this.support.createTicket(user.sub, dto.category, dto.message);
  }
}
