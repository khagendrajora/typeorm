import { Request, Response } from "express";
import { UserService } from "../services/userService";
import { UserDto } from "../dto/userDto";

const userService = new UserService();

export const createUser = async (req: Request, res: Response) => {
  try {
    const userDto: UserDto = req.body;
    const user = await userService.create(userDto);
    res.status(201).json(user);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const getAll = async (req: Request, res: Response) => {
  try {
    const users = await userService.getAll();
    return res.status(200).json(users);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const getById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const user = await userService.getById(Number(id));
    res.status(201).json(user);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const update = async (req: Request, res: Response) => {
  try {
    const id = req.params.id;
    const userDto: UserDto = req.body;
    const user = await userService.update(Number(id), userDto);
    res.status(201).json(user);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const deleteUser = async (req: Request, res: Response) => {
  try {
    const id = req.params.id;
    const user = await userService.delete(Number(id));
    res.status(201).json(user);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};
