import { AppDataSource } from "../config/database";
import { UserDto } from "../dto/userDto";
import { User } from "../entities/userentity";

export class UserService {
  private userRepo = AppDataSource.getRepository(User);

  async create(userDto: UserDto): Promise<User> {
    const user = this.userRepo.create(userDto);
    return await this.userRepo.save(user);
  }

  async getAll(): Promise<User[]> {
    const user = await this.userRepo.find();
    if (user.length <= 0) return [];

    return user;
  }

  async getById(id: number): Promise<User | null> {
    return await this.userRepo.findOneBy({ id });
  }

  async update(id: number, userDto: UserDto): Promise<User | null> {
    const user = await this.userRepo.update(id, userDto);

    if (user) {
      const updatedUser = await this.userRepo.findOneBy({ id });
      return updatedUser;
    } else {
      return null;
    }
  }

  async delete(id: number): Promise<number> {
    await this.userRepo.delete(id);
    return id;
  }
}
