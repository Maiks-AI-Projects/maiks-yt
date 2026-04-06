import { prisma } from '@/lib/prisma';
import { getMaiksYtId } from '@/lib/id';
import { Prisma, LedgerType, LedgerCategory } from '@prisma/client';
import { triggerEvent, EVENT_TYPES } from '@/lib/events';

export class DonationService {
  /**
   * Handles an incoming donation.
   * - Links the donation to the specified project.
   * - Automatically creates a Ledger entry (type: INCOME, category: DONATION).
   * - Checks for parent projects to ensure funding status trackability.
   */
  static async handleDonation(data: {
    userId?: string;
    amount: number | Prisma.Decimal;
    message?: string;
    projectId: string;
    channel?: string; // Optional channel for broadcast (e.g. 'mc', 'coding')
  }) {
    const donationId = getMaiksYtId('don');
    const ledgerId = getMaiksYtId('ledg');

    const donation = await prisma.$transaction(async (tx) => {
      // 1. Create the Donation entry
      const donation = await tx.donation.create({
        data: {
          id: donationId,
          userId: data.userId,
          amount: data.amount,
          message: data.message,
          projectId: data.projectId,
        },
        include: {
          project: {
            include: {
              parent: true,
            }
          }
        }
      });

      // 2. Create the Ledger entry for record-keeping
      await tx.ledger.create({
        data: {
          id: ledgerId,
          type: LedgerType.INCOME,
          category: LedgerCategory.DONATION,
          amount: data.amount,
          description: `Donation ${donationId} for Project: ${donation.project.name} (${donation.project.id})`,
        },
      });

      // 3. Parent Funding Status Check
      if (donation.project.parentId) {
        console.log(`Donation received for subproject. Parent project: ${donation.project.parentId}`);
      }

      return donation;
    });

    // 4. Trigger Real-time event after successful transaction
    triggerEvent(data.channel || 'global', EVENT_TYPES.DONATION, {
      id: donation.id,
      amount: donation.amount,
      message: donation.message,
      projectName: donation.project.name,
      userName: donation.userId || 'Anonymous',
    });

    return donation;
  }

  /**
   * Support 'Project Mothballing' (refund/redistribution logic placeholder).
   * Called when a project is archived or discontinued.
   */
  static async handleMothballedProject(projectId: string) {
    // Placeholder logic for refunding or redistributing funds.
    console.log(`Executing mothballing logic for project: ${projectId}`);
    
    // Logic might include:
    // 1. Finding all donations related to this project.
    // 2. Identifying donors who opted for refunds or redirection.
    // 3. Re-assigning the donation funds to a general fund or parent project.
    
    // TODO: Implement actual redistribution logic.
    return {
      status: 'pending_redistribution',
      projectId,
      message: 'Project has been mothballed. Funds are awaiting redistribution.',
    };
  }

  /**
   * Generates a report of income and expenses.
   */
  static async getIncomeExpenseReport() {
    const ledgerEntries = await prisma.ledger.findMany();

    const totals = {
      income: 0,
      expense: 0,
      balance: 0,
    };

    const categories: Record<string, { income: number; expense: number; balance: number }> = {
      TECH: { income: 0, expense: 0, balance: 0 },
      CLOTHING: { income: 0, expense: 0, balance: 0 },
      GROCERIES: { income: 0, expense: 0, balance: 0 },
    };

    ledgerEntries.forEach((entry) => {
      const amount = Number(entry.amount);
      if (entry.type === LedgerType.INCOME) {
        totals.income += amount;
        if (categories[entry.category]) {
          categories[entry.category].income += amount;
          categories[entry.category].balance += amount;
        }
      } else {
        totals.expense += amount;
        if (categories[entry.category]) {
          categories[entry.category].expense += amount;
          categories[entry.category].balance -= amount;
        }
      }
    });

    totals.balance = totals.income - totals.expense;

    return {
      totals,
      categories,
    };
  }
}
