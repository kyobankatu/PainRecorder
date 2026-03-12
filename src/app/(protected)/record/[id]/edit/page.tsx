import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';
import RecordForm from '@/components/RecordForm';

function toLocalDateTimeString(date: Date): string {
    const pad = (n: number) => String(n).padStart(2, '0');
    return (
        `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
        `T${pad(date.getHours())}:${pad(date.getMinutes())}`
    );
}

export default async function EditRecordPage({ params }: { params: { id: string } }) {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) { redirect('/'); }

    const record = await prisma.painRecord.findUnique({
        where: { id: params.id },
        include: { painEntries: true },
    });

    if (!record || record.userId !== session.user.id) { redirect('/dashboard'); }

    const painLevels: Record<string, number> = {};
    record.painEntries.forEach((e) => {
        painLevels[e.painTypeId] = e.level;
    });

    return (
        <div className="space-y-4">
            <h1 className="text-xl font-bold text-gray-800">記録を編集</h1>
            <RecordForm
                recordId={record.id}
                initialData={{
                    activityLevel: record.activityLevel,
                    comment: record.comment,
                    recordedAt: toLocalDateTimeString(new Date(record.recordedAt)),
                    painLevels,
                }}
            />
        </div>
    );
}
