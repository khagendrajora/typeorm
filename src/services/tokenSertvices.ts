import { AppDataSource } from "../config/database";
import { TokenDto } from "../dto/tokenDto";
import { Token } from "../entities/tokenEntity";

export class TokenService {
  private tokenRepo = AppDataSource.getRepository(Token);

  async create(token: string, userId: number): Promise<Token> {
    const create = this.tokenRepo.create({ token, userId });
    const newToken = await this.tokenRepo.save(create);
    return newToken;
  }

  async deleteToken(id: number): Promise<void> {
    await this.tokenRepo.delete(id);
  }
}
