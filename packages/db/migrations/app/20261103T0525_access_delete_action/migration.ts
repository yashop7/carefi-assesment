#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/19491e3b5dcc43a9bd2165c8e3bba4b060cb49e13d5c5662b2dd143f3c4676b4/contract';
import endContract from '../../snapshots/19491e3b5dcc43a9bd2165c8e3bba4b060cb49e13d5c5662b2dd143f3c4676b4/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/82954e9c0fc24bade4c143b9af41b6b8195f5f6415f996ad918bc45b6b060d54/contract';
import startContract from '../../snapshots/82954e9c0fc24bade4c143b9af41b6b8195f5f6415f996ad918bc45b6b060d54/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, sql } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.dropCheckConstraint({
        schema: 'public',
        table: 'AccessLog',
        constraint: 'AccessLog_action_check_c4a4121d',
      }),
      this.addCheckConstraint({
        schema: 'public',
        table: 'AccessLog',
        constraint: 'AccessLog_action_check_c7e230b3',
        expression: sql`"action" IN ('view_patient', 'view_document', 'view_query', 'upload', 'delete_file', 'denied')`,
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
