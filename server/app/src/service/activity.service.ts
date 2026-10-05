import { BadRequestException, Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import {
  ActivityFilterError,
  ActivityPage,
  RawActivityQuery,
  buildActivitySql,
  parseActivityFilter,
  parseActivityTypes,
  parsePage,
  parsePageSize,
  rowToEvent,
  totalPagesOf,
} from 'src/libs/activity/activity';

export type ActivityQuery = RawActivityQuery & {
  types?: string;
  page?: string;
  pageSize?: string;
};

// Admin history timeline: derived on read from branch / session / history / loginLog as one
// filtered UNION ALL (libs/activity), so a page and its total count come straight from Postgres.
@Injectable()
export class activityService {
  constructor(private readonly dataSource: DataSource) {}

  async getActivity(query: ActivityQuery): Promise<ActivityPage> {
    let filter;
    try {
      filter = parseActivityFilter(query);
    } catch (error) {
      if (error instanceof ActivityFilterError) {
        throw new BadRequestException(error.message);
      }
      throw error;
    }
    const types = parseActivityTypes(query.types);
    const page = parsePage(query.page);
    const pageSize = parsePageSize(query.pageSize);
    const { pageSql, countSql, params } = buildActivitySql(types, filter);

    const [countRows, rows] = await Promise.all([
      this.dataSource.query(countSql, params),
      this.dataSource.query(pageSql, [...params, pageSize, (page - 1) * pageSize]),
    ]);
    const total = Number(countRows[0]?.total ?? 0);

    return {
      events: rows.map(rowToEvent),
      total,
      page,
      pageSize,
      totalPages: totalPagesOf(total, pageSize),
    };
  }
}
