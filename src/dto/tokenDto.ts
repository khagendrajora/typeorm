import { IsDate, IsString } from "class-validator";

export class TokenDto {
  @IsString()
  token: string;

  @IsDate()
  created_at: Date;
}
