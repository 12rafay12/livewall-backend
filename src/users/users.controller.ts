import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UnauthorizedException,
  Headers,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { LoginDto } from './dto/login.dto';

@Controller('api/users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  async create(@Body() createUserDto: CreateUserDto) {
    const user = await this.usersService.create(createUserDto);
    // Return user without password
    const { password, ...result } = user.toObject();
    return result;
  }

  @Get()
  findAll() {
    return this.usersService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.usersService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateUserDto: UpdateUserDto) {
    return this.usersService.update(id, updateUserDto);
  }

  @Delete(':id')
  async delete(@Param('id') id: string) {
    await this.usersService.delete(id);
    return { message: 'User deleted successfully' };
  }

  @Post('admin/create')
  async createAdmin(
    @Body() createUserDto: CreateUserDto,
    @Headers('x-admin-secret') adminSecret: string,
  ) {
    const requiredSecret = process.env.ADMIN_CREATE_SECRET;

    if (!requiredSecret) {
      throw new UnauthorizedException(
        'Admin creation is not configured on this server',
      );
    }

    if (adminSecret !== requiredSecret) {
      throw new UnauthorizedException('Invalid admin creation secret');
    }

    const user = await this.usersService.createAdmin(createUserDto);
    // Return user without password
    const { password, ...result } = user.toObject();
    return result;
  }

  @Post('login')
  login(@Body() loginDto: LoginDto) {
    return this.usersService.login(loginDto);
  }
}
