export function getActionText(reason: string): string {
  switch (reason) {
    case "like":
      return "liked your post";
    case "repost":
      return "reposted your post";
    case "follow":
      return "followed you";
    case "mention":
      return "mentioned you";
    case "reply":
      return "replied to your post";
    case "quote":
      return "quoted your post";
    case "starterpack-joined":
      return "joined via your starterpack";
    case "verified":
      return "verified your account";
    case "unverified":
      return "unverified your account";
    case "like-via-repost":
      return "liked a repost of your post";
    case "repost-via-repost":
      return "reposted a repost of your post";
    default:
      return "interacted with your post";
  }
}

export function getActionCount(notifications: any[], type: string): number {
  return notifications.filter((n) => n.reason === type).length;
}
