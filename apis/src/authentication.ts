import { HookContext, Paginated, Params, ServiceAddons } from '@feathersjs/feathers';
import { AuthenticationService, JWTStrategy } from '@feathersjs/authentication';
import { LocalStrategy } from '@feathersjs/authentication-local';
import { expressOauth } from '@feathersjs/authentication-oauth';

import { Application } from './declarations';
import { Users } from './services/users/users.class';
import RolesEnum from './constants/roles.enum';
import { Player } from './services/player/player.class';
import { PlatformSuperAdmin } from './services/platform-super-admin/platform-super-admin.class';
import { Admin } from './services/admin/admin.class';

declare module './declarations' {
  interface ServiceTypes {
    'authentication': AuthenticationService & ServiceAddons<any>;
  }
}

export default function (app: Application): void {
  const authentication = new AuthenticationService(app);

  class CustomLocalStrategy extends LocalStrategy {
    async findEntity(username: string, params: Params): Promise<any> {
      // Find the user entity
      console.log(`username = ${username}`)
      const UserService: Users & ServiceAddons<any> = app.service('users');
      const user: any[] | Paginated<any> = await UserService.find({
        query: { email: username },
        paginate: false // To get only one user
      });
      // @ts-ignore
      if (user.length === 0) {
        return null; // User not found
      }

      // Get the first user (assuming email is unique)
      // @ts-ignore
      const foundUser = user[0];
      return { ...foundUser };
    }
  }

  authentication.register('jwt', new JWTStrategy());
  authentication.register('local', new CustomLocalStrategy());

  app.use('/authentication', authentication);
  app.configure(expressOauth());
  const service = app.service('authentication');

  service.hooks({
    after: {
      create: [
        async (context: HookContext) => {
          const { user } = context.result;
          console.log(user);

          if (user.role === RolesEnum.PLAYER) {
            // Load player data
            let playerData = null;
            const playerService: Player & ServiceAddons<any> = app.service('player');
            const player = await playerService._find({
              query: { user: user._id },
              paginate: false
            });
            playerData = player.length > 0 ? player[0] : null;

            console.log(playerData)
            context.result.user.playerData = playerData;
          }

          if (user.role === RolesEnum.ADMIN) {
            let adminData = null;
            const adminService: Admin & ServiceAddons<any> = app.service('admin');
            const psa = await adminService._find({
              query: { user: user._id },
              paginate: false
            });
            
            adminData = psa.length > 0 ? psa[0] : null;
            console.log(adminData)
            context.result.user.adminData = adminData;
          }

          if (user.role === RolesEnum.PLATFORM_SUPER_ADMIN) {
            let psaData = null;
            const psaService: PlatformSuperAdmin & ServiceAddons<any> = app.service('platform-super-admin');
            const psa = await psaService._find({
              query: { user: user._id },
              paginate: false
            });
            psaData = psa.length > 0 ? psa[0] : null;

            console.log(psaData)
            context.result.user.psaData = psaData;
          }
        }
      ]
    }
  });
}