export interface ListMember {
  did: string;
  handle: string;
  displayName?: string;
  avatar?: string;
  addedAt: string;
}

export interface List {
  id: string;
  name: string;
  description?: string;
  members: ListMember[];
  createdAt: string;
  updatedAt: string;
}

export interface ATProtocolListRecord {
  $type: "com.shadowsky.list";
  id: string;
  name: string;
  description?: string;
  members: ListMember[];
  createdAt: string;
  updatedAt: string;
}
