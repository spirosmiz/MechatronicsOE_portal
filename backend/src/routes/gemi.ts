import { Router, Response } from 'express';
import { authenticate } from '../middleware/auth';
import { AuthenticatedRequest } from '../types';

const router = Router();
router.use(authenticate);

export interface GemiCompany {
  gemiNumber: string;
  companyName: string;
  vatNumber: string;
  active: boolean;
}

router.get('/', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const name = (req.query.name as string)?.trim();
  if (!name || name.length < 2) {
    res.status(400).json({ message: 'name query param required (min 2 chars)' });
    return;
  }

  try {
    const response = await fetch(
      `https://publicity.businessportal.gr/api/autocomplete/${encodeURIComponent(name)}`,
      {
        method: 'POST',
        headers: {
          'Accept': 'application/json, text/plain, */*',
          'Content-Type': 'application/json',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Origin': 'https://publicity.businessportal.gr',
          'Referer': 'https://publicity.businessportal.gr/company/search',
        },
        signal: AbortSignal.timeout(10000),
      }
    );

    if (!response.ok) {
      res.status(502).json({ message: 'ΓΕΜΗ service unavailable' });
      return;
    }

    const data = await response.json() as {
      payload?: {
        autocomplete?: Array<{
          arGemi: number;
          co_name: string;
          afm: string;
          companyStatusId: number;
        }>;
      };
    };

    const companies: GemiCompany[] = (data.payload?.autocomplete ?? []).map((c) => ({
      gemiNumber: String(c.arGemi),
      companyName: c.co_name,
      vatNumber: c.afm,
      active: c.companyStatusId === 3,
    }));

    res.json(companies);
  } catch {
    res.status(502).json({ message: 'Failed to reach ΓΕΜΗ registry' });
  }
});

export default router;
