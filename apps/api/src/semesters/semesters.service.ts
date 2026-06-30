import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import type { Semester } from "@prisma/client";
import { PrismaService } from "../common/prisma.service";
import type { RequestAuth } from "../auth/auth.types";
import { assertSystemAdmin, hasSystemAdmin } from "../auth/policies";

type SemesterInput = {
  name?: string | undefined;
  startsAt?: string | undefined;
  endsAt?: string | undefined;
};

type CreateSemesterInput = {
  name: string;
  startsAt: string;
  endsAt: string;
};

type SemesterDto = {
  id: string;
  name: string;
  startsAt: string;
  endsAt: string;
  archivedAt: string | null;
  courseCount: number;
};

@Injectable()
export class SemestersService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async list(auth: RequestAuth): Promise<{ semesters: SemesterDto[] }> {
    const semesters = await this.prisma.semester.findMany({
      where: hasSystemAdmin(auth)
        ? {}
        : {
            archivedAt: null,
            courses: {
              some: {
                archivedAt: null,
                id: { in: auth.memberships.map((membership) => membership.courseId) }
              }
            }
          },
      include: {
        _count: {
          select: { courses: true }
        }
      },
      orderBy: [{ startsAt: "desc" }, { name: "asc" }]
    });
    return { semesters: semesters.map(toSemesterDto) };
  }

  async create(auth: RequestAuth, input: CreateSemesterInput): Promise<{ semester: SemesterDto }> {
    assertSystemAdmin(auth);
    const dates = parseSemesterDates(input);
    const semester = await this.prisma.semester.create({
      data: {
        name: input.name,
        startsAt: dates.startsAt,
        endsAt: dates.endsAt
      },
      include: {
        _count: {
          select: { courses: true }
        }
      }
    });
    return { semester: toSemesterDto(semester) };
  }

  async update(
    auth: RequestAuth,
    semesterId: string,
    input: SemesterInput
  ): Promise<{ semester: SemesterDto }> {
    assertSystemAdmin(auth);
    const existing = await this.prisma.semester.findUnique({ where: { id: semesterId } });
    if (!existing) throw semesterNotFound();
    const merged = {
      name: input.name ?? existing.name,
      startsAt: input.startsAt ?? existing.startsAt.toISOString(),
      endsAt: input.endsAt ?? existing.endsAt.toISOString()
    };
    const dates = parseSemesterDates(merged);
    const semester = await this.prisma.semester.update({
      where: { id: semesterId },
      data: {
        name: merged.name,
        startsAt: dates.startsAt,
        endsAt: dates.endsAt
      },
      include: {
        _count: {
          select: { courses: true }
        }
      }
    });
    return { semester: toSemesterDto(semester) };
  }

  async archive(auth: RequestAuth, semesterId: string): Promise<{ semester: SemesterDto }> {
    assertSystemAdmin(auth);
    const semester = await this.prisma.semester.update({
      where: { id: semesterId },
      data: { archivedAt: new Date() },
      include: {
        _count: {
          select: { courses: true }
        }
      }
    });
    return { semester: toSemesterDto(semester) };
  }
}

function parseSemesterDates(input: CreateSemesterInput): { startsAt: Date; endsAt: Date } {
  const startsAt = new Date(input.startsAt);
  const endsAt = new Date(input.endsAt);
  if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime()) || startsAt >= endsAt) {
    throw new BadRequestException({
      code: "SEMESTER_DATES_INVALID",
      message: "Semester start date must be before the end date."
    });
  }
  return { startsAt, endsAt };
}

function toSemesterDto(
  semester: Semester & {
    _count?: { courses: number };
  }
): SemesterDto {
  return {
    id: semester.id,
    name: semester.name,
    startsAt: semester.startsAt.toISOString(),
    endsAt: semester.endsAt.toISOString(),
    archivedAt: semester.archivedAt?.toISOString() ?? null,
    courseCount: semester._count?.courses ?? 0
  };
}

function semesterNotFound(): NotFoundException {
  return new NotFoundException({
    code: "SEMESTER_NOT_FOUND",
    message: "Semester not found."
  });
}
