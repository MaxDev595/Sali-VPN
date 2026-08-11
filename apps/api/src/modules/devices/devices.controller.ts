import { Body, Controller, Delete, Get, Param, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthTokenPayload } from '../auth/auth.service';
import { DevicesService } from './devices.service';
import { AddDeviceDto } from './dto/add-device.dto';

@Controller('devices')
@UseGuards(JwtAuthGuard)
export class DevicesController {
  constructor(private readonly devices: DevicesService) {}

  @Get()
  list(@CurrentUser() user: AuthTokenPayload) {
    return this.devices.list(user.sub);
  }

  @Post()
  add(@CurrentUser() user: AuthTokenPayload, @Body() dto: AddDeviceDto) {
    return this.devices.add(user.sub, dto.name, dto.platform);
  }

  @Delete(':id')
  remove(@CurrentUser() user: AuthTokenPayload, @Param('id') id: string) {
    return this.devices.remove(user.sub, id);
  }
}
