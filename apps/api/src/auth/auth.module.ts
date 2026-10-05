import { Global, Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { PasswordService } from './password.service';
import { TokenService } from './token.service';
import { MailService } from './mail.service';
import { AuthGuard } from './auth.guard';

@Global()
@Module({
  imports: [JwtModule.register({})],
  controllers: [AuthController],
  providers: [AuthService, PasswordService, TokenService, MailService, AuthGuard],
  exports: [AuthService, AuthGuard, JwtModule, PasswordService, TokenService, MailService],
})
export class AuthModule {}
