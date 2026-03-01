import { Response } from 'express';
import { AuthenticatedRequest } from '../types/index.js';
import { prisma } from '../utils/prisma.js';

export async function getCurrentVersions(
  _req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  res.json({
    privacyVersion: process.env.PRIVACY_VERSION || '1.0',
    tosVersion: process.env.TOS_VERSION || '1.0',
  });
}

export async function acceptLegalTerms(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  const userId = req.userId!;
  const { privacyVersion, tosVersion } = req.body as {
    privacyVersion?: string;
    tosVersion?: string;
  };

  await prisma.user.update({
    where: { id: userId },
    data: {
      privacyPolicyVersion: privacyVersion,
      tosVersion,
      tosAcceptedAt: new Date(),
    },
  });

  res.json({ success: true });
}
