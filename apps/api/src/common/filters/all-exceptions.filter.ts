import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { FastifyReply } from 'fastify';

// Central place that turns *any* thrown error into a safe, user-facing
// response. Technical details are logged server-side only — the client
// never sees stack traces or raw error messages from unexpected failures.
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('ExceptionsFilter');

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const reply = ctx.getResponse<FastifyReply>();

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const response = exception.getResponse();
      const message =
        typeof response === 'string'
          ? response
          : (response as any)?.message ?? exception.message;

      reply.status(status).send({
        code: HttpStatus[status] ?? 'ERROR',
        message: Array.isArray(message) ? message[0] : message,
      });
      return;
    }

    this.logger.error(
      exception instanceof Error ? exception.stack : JSON.stringify(exception),
    );

    reply.status(500).send({
      code: 'INTERNAL_ERROR',
      message: 'Что-то пошло не так. Попробуйте ещё раз.',
    });
  }
}
