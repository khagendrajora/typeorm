import { Column, Entity, PrimaryGeneratedColumn } from "typeorm";

@Entity({ name: "token" })
export class Token {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  token: string;

  @Column()
  userId: number;

  @Column({ type: "timestamp", default: () => "NOW()" })
  created_at: Date;
}
