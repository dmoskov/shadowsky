export interface ReplyToPost {
  uri: string;
  cid: string;
  author: {
    handle: string;
    displayName?: string;
    avatar?: string;
  };
  text: string;
}

export interface QuoteToPost {
  uri: string;
  cid: string;
  author: {
    handle: string;
    displayName?: string;
    avatar?: string;
  };
  text: string;
}

export interface ComposeScreenProps {
  replyTo?: ReplyToPost;
  quoteTo?: QuoteToPost;
  draftId?: string;
  sharedUrl?: string;
  sharedText?: string;
  initialText?: string;
  sharedImages?: string[];
}
