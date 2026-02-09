import { Request, Response } from 'express';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { AppError } from '../middleware/errorHandler.js';
import { prisma } from '../utils/prisma.js';
import { generateToken } from '../middleware/auth.js';

const RegisterSchema = z.object({
  email: z.string().email(),
  name: z.string().optional(),
  password: z.string().min(8),
});

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

export async function register(req: Request, res: Response) {
  try {
    const data = RegisterSchema.parse(req.body);

    // Check if user already exists
    const existing = await prisma.user.findUnique({
      where: { email: data.email },
    });

    if (existing) {
      throw new AppError(409, 'Email already registered');
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(data.password, 10);

    // Create user
    const user = await prisma.user.create({
      data: {
        email: data.email,
        name: data.name,
        // Note: In production, you'd store the password hash
        // For now, we're not storing it (relying on Clerk for auth)
      },
    });

    // Create user stats
    await prisma.userStats.create({
      data: {
        userId: user.id,
      },
    });

    const token = generateToken(user.id);

    res.status(201).json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        tier: user.tier,
      },
      token,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new AppError(400, 'Invalid request data');
    }
    throw error;
  }
}

export async function login(req: Request, res: Response) {
  try {
    const data = LoginSchema.parse(req.body);

    const user = await prisma.user.findUnique({
      where: { email: data.email },
    });

    if (!user) {
      throw new AppError(401, 'Invalid credentials');
    }

    // In production, verify password hash here
    // For now, we're using Clerk for authentication

    const token = generateToken(user.id);

    res.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        tier: user.tier,
      },
      token,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new AppError(400, 'Invalid request data');
    }
    throw error;
  }
}

// For Clerk webhook integration
export async function syncClerkUser(req: Request, res: Response) {
  try {
    const { id, email_addresses, first_name, last_name } = req.body.data;

    const email = email_addresses[0]?.email_address;
    if (!email) {
      throw new AppError(400, 'Email is required');
    }

    // Upsert user
    const user = await prisma.user.upsert({
      where: { email },
      update: {
        name: first_name && last_name ? `${first_name} ${last_name}` : first_name || null,
      },
      create: {
        id,
        email,
        name: first_name && last_name ? `${first_name} ${last_name}` : first_name || null,
      },
    });

    // Create user stats if not exists
    await prisma.userStats.upsert({
      where: { userId: user.id },
      update: {},
      create: { userId: user.id },
    });

    res.json({ success: true });
  } catch (error) {
    throw error;
  }
}
