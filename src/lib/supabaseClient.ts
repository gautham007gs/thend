
type FilterOperator = 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte';

type QueryFilter = {
  column: string;
  operator: FilterOperator;
  value: any;
};

type OrderBy = {
  column: string;
  ascending: boolean;
};

type QueryState = {
  action: 'select' | 'update' | 'upsert' | 'delete' | 'insert' | 'rpc';
  table: string;
  filters: QueryFilter[];
  selectColumns?: string;
  orderBy?: OrderBy;
  limit?: number;
  offset?: number;
  data?: any;
  single?: boolean;
  maybeSingle?: boolean;
  rpcName?: string;
  rpcParams?: Record<string, any>;
};

type QueryResult<T = any> = {
  data: T;
  error: null | { message: string };
};

const isBrowser = typeof window !== 'undefined';
const isDatabaseConfigured = Boolean(
  process.env.MYSQL_HOST &&
  process.env.MYSQL_USER &&
  process.env.MYSQL_DATABASE
);

const buildWhereClause = (filters: QueryFilter[]) => {
  if (!filters.length) {
    return { clause: '', values: [] as any[] };
  }

  const clauses: string[] = [];
  const values: any[] = [];
  filters.forEach(filter => {
    const operatorMap: Record<FilterOperator, string> = {
      eq: '=',
      neq: '!=',
      gt: '>',
      gte: '>=',
      lt: '<',
      lte: '<='
    };
    clauses.push(`\`${filter.column}\` ${operatorMap[filter.operator]} ?`);
    values.push(filter.value);
  });

  return { clause: `WHERE ${clauses.join(' AND ')}`, values };
};

export const executeServerQuery = async (state: QueryState): Promise<QueryResult> => {
  const { getMysqlClient } = await import('./mysql-client');
  const client = await getMysqlClient();

  try {
    if (state.action === 'rpc' && state.rpcName) {
      if (state.rpcName === 'increment_session_messages') {
        const sessionId = state.rpcParams?.session_id_param;
        await client.query(
          `INSERT INTO user_sessions (session_id, user_pseudo_id, messages_sent, is_active)
           VALUES (?, ?, 1, 1)
           ON DUPLICATE KEY UPDATE messages_sent = COALESCE(messages_sent, 0) + 1, is_active = 1`,
          [sessionId, sessionId]
        );
        return { data: null, error: null };
      }
      if (state.rpcName === 'get_daily_message_counts') {
        const startDate = state.rpcParams?.start_date;
        const [rows] = await client.query(
          `SELECT DATE(created_at) AS date, COUNT(*) AS messages
           FROM messages_log
           WHERE created_at >= ?
           GROUP BY DATE(created_at)
           ORDER BY DATE(created_at) ASC`,
          [startDate]
        );
        return { data: Array.isArray(rows) ? rows : [], error: null };
      }
      if (state.rpcName === 'get_daily_active_user_counts') {
        const startDate = state.rpcParams?.start_date;
        const [rows] = await client.query(
          `SELECT activity_date AS date, COUNT(DISTINCT user_pseudo_id) AS active_users
           FROM daily_activity_log
           WHERE activity_date >= ?
           GROUP BY activity_date
           ORDER BY activity_date ASC`,
          [startDate]
        );
        return { data: Array.isArray(rows) ? rows : [], error: null };
      }
      return { data: null, error: { message: `RPC ${state.rpcName} not implemented` } };
    }

    if (state.action === 'insert') {
      const rows = Array.isArray(state.data) ? state.data : [state.data];
      if (!rows.length) return { data: [], error: null };
      const columns = Object.keys(rows[0]);
      const placeholders = rows.map(() => `(${columns.map(() => '?').join(', ')})`).join(', ');
      const values = rows.flatMap(row => columns.map(col => row[col]));
      const sql = `INSERT INTO \`${state.table}\` (${columns.map(c => `\`${c}\``).join(', ')}) VALUES ${placeholders}`;
      await client.query(sql, values);
      return { data: rows, error: null };
    }

    if (state.action === 'update' || state.action === 'upsert') {
      const rows = Array.isArray(state.data) ? state.data : [state.data];
      if (!rows.length) return { data: [], error: null };
      const columns = Object.keys(rows[0]);
      if (state.action === 'upsert') {
        const placeholders = rows.map(() => `(${columns.map(() => '?').join(', ')})`).join(', ');
        const values = rows.flatMap(row => columns.map(col => row[col]));
        const updateClause = columns.map(col => `\`${col}\` = VALUES(\`${col}\`)`).join(', ');
        const sql = `INSERT INTO \`${state.table}\` (${columns.map(c => `\`${c}\``).join(', ')}) VALUES ${placeholders} ON DUPLICATE KEY UPDATE ${updateClause}`;
        await client.query(sql, values);
        return { data: rows, error: null };
      }

      const { clause, values: whereValues } = buildWhereClause(state.filters);
      const setClause = columns.map(col => `\`${col}\` = ?`).join(', ');
      const sql = `UPDATE \`${state.table}\` SET ${setClause} ${clause}`;
      const values = [...columns.map(col => rows[0][col]), ...whereValues];
      await client.query(sql, values);
      return { data: rows[0], error: null };
    }

    if (state.action === 'delete') {
      const { clause, values } = buildWhereClause(state.filters);
      const sql = `DELETE FROM \`${state.table}\` ${clause}`;
      await client.query(sql, values);
      return { data: null, error: null };
    }

    if (state.action === 'select') {
      const columns = state.selectColumns ? state.selectColumns : '*';
      const { clause, values } = buildWhereClause(state.filters);
      const orderClause = state.orderBy
        ? `ORDER BY \`${state.orderBy.column}\` ${state.orderBy.ascending ? 'ASC' : 'DESC'}`
        : '';
      const limitClause = state.limit !== undefined ? `LIMIT ${state.limit}` : '';
      const offsetClause = state.offset !== undefined ? `OFFSET ${state.offset}` : '';
      const sql = `SELECT ${columns} FROM \`${state.table}\` ${clause} ${orderClause} ${limitClause} ${offsetClause}`.trim();
      const [rows] = await client.query(sql, values);
      const data = Array.isArray(rows) ? rows : [];
      if (state.single) {
        return { data: data[0] || null, error: null };
      }
      if (state.maybeSingle) {
        return { data: data[0] || null, error: null };
      }
      return { data, error: null };
    }

    return { data: null, error: { message: 'Unsupported query action' } };
  } catch (error: any) {
    return { data: null, error: { message: error.message || 'Database error' } };
  }
};

const executeApiQuery = async (state: QueryState): Promise<QueryResult> => {
  try {
    const response = await fetch('/api/db', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(state)
    });
    const payload = await response.json();
    if (!response.ok) {
      return { data: null, error: { message: payload?.error || 'Request failed' } };
    }
    return { data: payload.data ?? null, error: null };
  } catch (error: any) {
    return { data: null, error: { message: error.message || 'Request failed' } };
  }
};

class QueryBuilder {
  private state: QueryState;

  constructor(table: string) {
    this.state = {
      action: 'select',
      table,
      filters: []
    };
  }

  select(columns = '*') {
    this.state.action = 'select';
    this.state.selectColumns = columns;
    return this;
  }

  insert(data: any) {
    return this.execute({ action: 'insert', data });
  }

  update(data: any) {
    this.state.action = 'update';
    this.state.data = data;
    return this;
  }

  upsert(data: any) {
    this.state.action = 'upsert';
    this.state.data = data;
    return this;
  }

  delete() {
    this.state.action = 'delete';
    return this;
  }

  eq(column: string, value: any) {
    this.state.filters.push({ column, operator: 'eq', value });
    return this;
  }

  neq(column: string, value: any) {
    this.state.filters.push({ column, operator: 'neq', value });
    return this;
  }

  gt(column: string, value: any) {
    this.state.filters.push({ column, operator: 'gt', value });
    return this;
  }

  gte(column: string, value: any) {
    this.state.filters.push({ column, operator: 'gte', value });
    return this;
  }

  lt(column: string, value: any) {
    this.state.filters.push({ column, operator: 'lt', value });
    return this;
  }

  lte(column: string, value: any) {
    this.state.filters.push({ column, operator: 'lte', value });
    return this;
  }

  order(column: string, options: { ascending?: boolean } = {}) {
    this.state.orderBy = { column, ascending: options.ascending ?? true };
    return this;
  }

  limit(count: number) {
    this.state.limit = count;
    return this;
  }

  range(from: number, to: number) {
    this.state.offset = from;
    this.state.limit = to - from + 1;
    return this;
  }

  maybeSingle() {
    this.state.maybeSingle = true;
    return this;
  }

  single() {
    this.state.single = true;
    return this;
  }

  rpc(name: string, params?: Record<string, any>) {
    return this.execute({ action: 'rpc', rpcName: name, rpcParams: params });
  }

  private async execute(overrides?: Partial<QueryState>) {
    const state = { ...this.state, ...overrides } as QueryState;
    if (isBrowser) {
      return executeApiQuery(state);
    }
    return executeServerQuery(state);
  }

  then<TResult1 = QueryResult, TResult2 = never>(
    onfulfilled?: ((value: QueryResult) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null
  ) {
    return this.execute().then(onfulfilled, onrejected);
  }
}

export const supabase = {
  from: (table: string) => new QueryBuilder(table),
  auth: {
    signInWithPassword: async () => {
      return { data: null, error: { message: 'Use /api/admin/login instead.' } };
    },
    getUser: async () => {
      return { data: { user: null }, error: { message: 'Use /api/admin/session instead.' } };
    },
    getSession: async () => {
      return { data: { session: null }, error: { message: 'Use /api/admin/session instead.' } };
    }
  },
  rpc: (name: string, params?: Record<string, any>) => new QueryBuilder('_rpc').rpc(name, params)
};

export { isDatabaseConfigured };

export type { QueryState, QueryResult };
