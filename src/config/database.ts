import { DataSource } from "typeorm";
import { User } from "../entities/userentity";

export const AppDataSource = new DataSource({
  type: "postgres",
  host: "localhost",
  port: 5432,
  username: "myuser",
  password: "admin",
  database: "typeorm",
  synchronize: true,
  entities: [User],
  logging: false,
  migrations: ["./src/migration/*.ts"],
  subscribers: [],
});
