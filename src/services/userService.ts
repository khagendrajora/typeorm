import { compare } from "bcrypt";
import { AppDataSource } from "../config/database";
import { UserDto } from "../dto/userDto";
import { User } from "../entities/userentity";
import jwt from "jsonwebtoken";
import { Token } from "../entities/tokenEntity";
import { TokenService } from "./tokenSertvices";

export class UserService {
  private userRepo = AppDataSource.getRepository(User);
  private tokenService = new TokenService();

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

  async login(email: string, password: string) {
    const user = await this.userRepo.findOneBy({ email: email });

    if (!user) {
      return "Email not found";
    }

    const checkpass = await compare(password, user.password);

    if (!checkpass) {
      return "Invalid Credentials";
    }

    const newToken = jwt.sign(
      {
        data: user.id,
      },
      "secrets",
      { expiresIn: "1h" }
    );

    if (!newToken) {
      return { message: "login Failed" };
    }
    // const saveToken = await this.tokenRepo.save({
    //   token: newToken,
    //   userId: user.id,
    // });

    const saveToken = this.tokenService.create(newToken, user.id);

    if (!saveToken) {
      return { message: "login Failed" };
    }

    
    return { message: "Login Successfull", email };
  }
}
