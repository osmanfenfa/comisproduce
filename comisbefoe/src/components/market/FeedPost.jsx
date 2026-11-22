import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  ThumbsUp, MessageCircle, Share2, Bookmark, BadgeCheck, MapPin, Send, Trash2, MoreHorizontal, CheckCircle2,
} from "lucide-react";
import client from "../../api/client.js";
import UserAvatar from "../shared/UserAvatar.jsx";
import { useAuthStore } from "../../store/authStore.js";
import { priceLabel, qtyLabel, mediaUrl, timeAgo } from "../../utils/market.js";

const ROLE_LABEL = { farmer: "Farmer", trader: "Trader", produce_manager: "Buying station", produce_secretary: "Buying station" };

export function Avatar({ person, size = "w-11 h-11 text-base" }) {
  return (
    <UserAvatar src={person.avatar_url} name={person.business_name || person.name} role={person.role} size={size} />
  );
}

function PersonLine({ person }) {
  return (
    <span className="flex items-center gap-1 min-w-0">
      <span className="font-bold text-slate-900 truncate">{person.business_name || person.name}</span>
      {person.verified && <BadgeCheck className="w-4 h-4 text-[#168821] shrink-0" aria-label="Verified" />}
    </span>
  );
}

/** Like / Comment / Share / Save bar with the counts line above it. */
export function PostActions({ post, onChange, onCommentClick }) {
  const { role } = useAuthStore();
  const canInteract = role !== "system_admin";
  const [toast, setToast] = useState("");

  const flash = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(""), 2000);
  };

  const toggle = async (kind) => {
    const on = kind === "like" ? !post.liked_by_me : !post.saved_by_me;
    // Optimistic: update immediately, roll back if the server refuses
    const before = { ...post };
    onChange(kind === "like"
      ? { ...post, liked_by_me: on, like_count: post.like_count + (on ? 1 : -1) }
      : { ...post, saved_by_me: on });
    try {
      const { data } = await (on ? client.put : client.delete)(`/market/listings/${post.id}/${kind}`);
      if (kind === "like") onChange({ ...post, liked_by_me: on, like_count: data.count });
      if (kind === "save") flash(on ? "Saved — find it under Saved" : "Removed from Saved");
    } catch {
      onChange(before);
      flash("Could not update. Check your connection.");
    }
  };

  const share = async () => {
    const url = `${window.location.origin}/market/listing/${post.id}`;
    const text = `${post.title} — ${priceLabel(post)} (${post.district}) on COMIS Market`;
    try {
      if (navigator.share) {
        await navigator.share({ title: post.title, text, url });
        return;
      }
      await navigator.clipboard.writeText(`${text}\n${url}`);
      flash("Link copied — paste it in WhatsApp or SMS");
    } catch {
      /* share sheet closed */
    }
  };

  const btn = "flex-1 flex items-center justify-center gap-1 py-2 rounded-lg text-[11px] sm:text-xs font-semibold transition hover:bg-slate-100 cursor-pointer disabled:cursor-default disabled:hover:bg-transparent";

  return (
    <div className="relative">
      {(post.like_count > 0 || post.comment_count > 0) && (
        <div className="px-4 py-1.5 flex items-center justify-between text-[11px] text-slate-500">
          <span className="flex items-center gap-1">
            {post.like_count > 0 && (
              <>
                <span className="w-4 h-4 rounded-full bg-[#168821] flex items-center justify-center">
                  <ThumbsUp className="w-2.5 h-2.5 text-white fill-white" />
                </span>
                {post.like_count}
              </>
            )}
          </span>
          {post.comment_count > 0 && (
            <button onClick={onCommentClick} className="hover:underline hover:text-[#168821] cursor-pointer">
              {post.comment_count} comment{post.comment_count > 1 ? "s" : ""}
            </button>
          )}
        </div>
      )}
      <div className="mx-2 border-t border-slate-200 flex text-slate-600">
        <button disabled={!canInteract} onClick={() => toggle("like")}
          className={`${btn} ${post.liked_by_me ? "text-[#168821]" : ""}`} aria-pressed={post.liked_by_me}>
          <ThumbsUp className={`w-4 h-4 ${post.liked_by_me ? "fill-[#168821]" : ""}`} /> Like
        </button>
        <button onClick={onCommentClick} className={btn}>
          <MessageCircle className="w-4 h-4" /> Comment
        </button>
        <button onClick={share} className={btn}>
          <Share2 className="w-4 h-4" /> Share
        </button>
        <button disabled={!canInteract} onClick={() => toggle("save")}
          className={`${btn} ${post.saved_by_me ? "text-[#b38600]" : ""}`} aria-pressed={post.saved_by_me}>
          <Bookmark className={`w-4 h-4 ${post.saved_by_me ? "fill-[#d4a000] text-[#b38600]" : ""}`} /> {post.saved_by_me ? "Saved" : "Save"}
        </button>
      </div>
      {toast && (
        <div className="absolute left-1/2 -translate-x-1/2 -top-2 -translate-y-full bg-slate-900 text-white text-[11px] font-semibold px-3 py-1.5 rounded-lg shadow-lg whitespace-nowrap z-10">
          {toast}
        </div>
      )}
    </div>
  );
}

/** Box for writing a comment or a reply. */
function CommentBox({ onSubmit, placeholder, autoFocus, initial = "", inputId, small = false }) {
  const [body, setBody] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const submit = async (e) => {
    e.preventDefault();
    if (!body.trim()) return;
    setBusy(true);
    setError("");
    try {
      await onSubmit(body.trim());
      setBody("");
    } catch (err) {
      setError(err.response?.data?.detail || "Could not post. Try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit}>
      <div className="flex items-center gap-2">
        <input
          id={inputId}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          maxLength={1000}
          autoFocus={autoFocus}
          placeholder={placeholder}
          className={`flex-1 min-w-0 border border-slate-300 rounded-full px-3.5 focus:outline-none focus:ring-2 focus:ring-emerald-700 ${
            small ? "py-1.5 text-xs" : "py-2 text-sm"
          }`}
        />
        <button disabled={busy || !body.trim()} aria-label="Post"
          className={`${small ? "w-7 h-7" : "w-9 h-9"} rounded-full bg-[#168821] text-white flex items-center justify-center disabled:opacity-40 shrink-0 cursor-pointer`}>
          <Send className={small ? "w-3 h-3" : "w-4 h-4"} />
        </button>
      </div>
      {error && <p className="text-[11px] text-red-600 mt-1">{error}</p>}
    </form>
  );
}

/** One comment or reply: plain text like a social app, no bubble. */
const LONG_COMMENT = 200;        // characters before "Read more"

function CommentItem({ comment, canInteract, onLike, onReply, onDelete, reply = false }) {
  const name = comment.author.business_name || comment.author.name;
  const [expanded, setExpanded] = useState(false);
  const long = comment.body.length > LONG_COMMENT || comment.body.split(/\r?\n/).length > 4;
  return (
    <div className="flex gap-2">
      <Avatar person={comment.author} size={reply ? "w-6 h-6 text-[10px]" : "w-8 h-8 text-xs"} />
      <div className="flex-1 min-w-0">
        <p className="text-xs leading-tight">
          <span className="font-bold text-slate-900">{name}</span>
          {comment.author.verified && <BadgeCheck className="inline w-3 h-3 text-[#168821] ml-0.5 -mt-0.5" />}
          <span className="text-[10px] text-slate-400"> · {ROLE_LABEL[comment.author.role] || "Member"}</span>
        </p>
        <p className={`text-[13px] text-slate-800 whitespace-pre-line break-words mt-0.5 ${long && !expanded ? "line-clamp-3" : ""}`}>
          {comment.body}
        </p>
        {long && !expanded && (
          <button onClick={() => setExpanded(true)} className="text-[11px] font-semibold text-slate-500 hover:text-[#168821] cursor-pointer">
            Read more
          </button>
        )}
        <div className="flex items-center gap-3 mt-1 text-[11px] font-semibold text-slate-500">
          <span className="font-normal text-slate-400">{timeAgo(comment.created_at)}</span>
          {canInteract && (
            <button onClick={() => onLike(comment)} aria-pressed={comment.liked_by_me}
              className={`cursor-pointer hover:text-[#168821] ${comment.liked_by_me ? "text-[#168821]" : ""}`}>
              Like
            </button>
          )}
          {canInteract && (
            <button onClick={() => onReply(comment)} className="cursor-pointer hover:text-[#168821]">Reply</button>
          )}
          {comment.like_count > 0 && (
            <span className="flex items-center gap-0.5 font-normal">
              <ThumbsUp className="w-3 h-3 text-[#168821] fill-[#168821]" />
              {comment.like_count}
            </span>
          )}
          {comment.can_delete && (
            <button onClick={() => onDelete(comment)} aria-label="Delete comment"
              className="ml-auto text-slate-300 hover:text-red-600 cursor-pointer">
              <Trash2 className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

const FIRST_COMMENTS = 3;    // shown when comments open
const MORE_COMMENTS = 5;     // added per "Load more comments"
const FIRST_REPLIES = 1;     // per thread, before "See more replies"

/** Comments with likes and one level of replies. Loads when opened. */
export function Comments({ post, onCountChange, autoFocus = false }) {
  const { role } = useAuthStore();
  const canInteract = role !== "system_admin";
  const [comments, setComments] = useState(null);
  const [replyTo, setReplyTo] = useState(null);   // { threadId, mention }
  // Paging: a few comments at first, one reply per thread until "See more replies"
  const [visibleTop, setVisibleTop] = useState(FIRST_COMMENTS);
  const [openThreads, setOpenThreads] = useState(() => new Set());
  const [mine, setMine] = useState(() => new Set());   // just posted here: always shown

  useEffect(() => {
    let cancelled = false;
    client.get(`/market/listings/${post.id}/comments`)
      .then(({ data }) => !cancelled && setComments(data))
      .catch(() => !cancelled && setComments([]));
    return () => {
      cancelled = true;
    };
  }, [post.id]);

  const add = async (body, parentId = null) => {
    const { data } = await client.post(`/market/listings/${post.id}/comments`, { body, parent_id: parentId });
    setComments((prev) => [...(prev || []), data]);
    setMine((prev) => new Set(prev).add(data.id));
    if (parentId) setOpenThreads((prev) => new Set(prev).add(parentId));
    onCountChange(post.comment_count + 1);
    if (parentId) setReplyTo(null);
  };

  const like = async (c) => {
    const on = !c.liked_by_me;
    const update = (patch) => setComments((prev) => prev.map((x) => (x.id === c.id ? { ...x, ...patch } : x)));
    update({ liked_by_me: on, like_count: c.like_count + (on ? 1 : -1) });
    try {
      const { data } = await (on ? client.put : client.delete)(`/market/comments/${c.id}/like`);
      update({ liked_by_me: on, like_count: data.count });
    } catch {
      update({ liked_by_me: c.liked_by_me, like_count: c.like_count });
    }
  };

  const remove = async (c) => {
    if (!window.confirm(c.parent_id ? "Delete this reply?" : "Delete this comment and its replies?")) return;
    const { data } = await client.delete(`/market/comments/${c.id}`);
    setComments((prev) => prev.filter((x) => x.id !== c.id && x.parent_id !== c.id));
    onCountChange(Math.max(0, post.comment_count - (data.deleted || 1)));
  };

  const startReply = (c) => {
    const name = c.author.business_name || c.author.name;
    setReplyTo({ threadId: c.parent_id || c.id, mention: c.parent_id ? `@${name} ` : "" });
  };

  const top = (comments || []).filter((c) => !c.parent_id);
  const repliesOf = (id) => (comments || []).filter((c) => c.parent_id === id);
  const shownTop = top.filter((c, i) => i < visibleTop || mine.has(c.id));
  const hiddenTop = top.length - shownTop.length;

  return (
    <div className="px-4 pb-3 pt-2 space-y-3">
      {canInteract && (
        <CommentBox onSubmit={(b) => add(b)} placeholder="Add a comment..." autoFocus={autoFocus}
          inputId={autoFocus ? undefined : "comment-box"} />
      )}
      {comments === null ? (
        <p className="text-xs text-slate-400">Loading comments...</p>
      ) : top.length === 0 ? (
        <p className="text-xs text-slate-400">No comments yet. Ask about quality, delivery or price.</p>
      ) : (
        <>
        {shownTop.map((c) => {
          const replies = repliesOf(c.id);
          const open = openThreads.has(c.id) || replyTo?.threadId === c.id;
          const shownReplies = open ? replies : replies.filter((r, i) => i < FIRST_REPLIES || mine.has(r.id));
          const hiddenReplies = replies.length - shownReplies.length;
          return (
          <div key={c.id} className="space-y-2">
            <CommentItem comment={c} canInteract={canInteract} onLike={like} onReply={startReply} onDelete={remove} />
            {(replies.length > 0 || replyTo?.threadId === c.id) && (
              <div className="ml-10 space-y-2">
                {shownReplies.map((r) => (
                  <CommentItem key={r.id} comment={r} reply canInteract={canInteract}
                    onLike={like} onReply={startReply} onDelete={remove} />
                ))}
                {hiddenReplies > 0 && (
                  <button onClick={() => setOpenThreads((prev) => new Set(prev).add(c.id))}
                    className="text-[11px] font-bold text-[#168821] hover:underline cursor-pointer">
                    See {hiddenReplies} more {hiddenReplies === 1 ? "reply" : "replies"}
                  </button>
                )}
                {replyTo?.threadId === c.id && (
                  <CommentBox key={replyTo.mention} small autoFocus initial={replyTo.mention}
                    placeholder={`Reply to ${c.author.business_name || c.author.name}...`}
                    onSubmit={(b) => add(b, c.id)} />
                )}
              </div>
            )}
          </div>
          );
        })}
        {hiddenTop > 0 && (
          <button onClick={() => setVisibleTop((n) => n + MORE_COMMENTS)}
            className="text-xs font-bold text-[#168821] hover:underline cursor-pointer">
            Load more comments ({hiddenTop})
          </button>
        )}
        </>
      )}
    </div>
  );
}

/** LinkedIn-style feed post. */
export default function FeedPost({ post: initial }) {
  const [post, setPost] = useState(initial);
  const [showComments, setShowComments] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const media = post.media;
  const photos = media.filter((m) => m.kind === "photo");
  const video = media.find((m) => m.kind === "video");
  const longText = (post.description || "").length > 180;

  return (
    <article className="border-2 border-[#168821] rounded-2xl overflow-hidden bg-white shadow-xs">
      {/* Same yellow header bar as the Home cards: post type · category */}
      <div className="bg-[#d4a000] text-[#0f5c18] px-4 py-1 flex items-center justify-between gap-2 text-[10px] font-black uppercase tracking-wide">
        <span className="flex items-center gap-1.5 min-w-0">
          <span className={`px-1.5 py-px rounded text-white ${post.kind === "wanted" ? "bg-[#0f5c18]" : "bg-[#168821]"}`}>
            {post.kind === "wanted" ? "Wanted" : "For sale"}
          </span>
          <span className="truncate">{post.category_label}</span>
        </span>
        <span className="flex items-center gap-1.5 shrink-0">
          {post.status === "sold" && (
            <span className="flex items-center gap-0.5 px-1.5 py-px rounded bg-white text-[#0f5c18]">
              <CheckCircle2 className="w-3 h-3" /> Fulfilled
            </span>
          )}
          <span className="font-bold normal-case tracking-normal">{timeAgo(post.created_at)}</span>
        </span>
      </div>

      {/* Author */}
      <header className="px-4 pt-2.5 flex items-start gap-2.5">
        <Avatar person={post.owner} size="w-9 h-9 text-sm" />
        <div className="min-w-0 flex-1 text-[13px] leading-tight">
          <PersonLine person={post.owner} />
          <p className="text-[10px] text-slate-500 truncate flex items-center gap-1">
            {ROLE_LABEL[post.owner.role] || "Member"} · <MapPin className="w-2.5 h-2.5 shrink-0" />
            {[post.chiefdom, post.district].filter(Boolean).join(", ")}
          </p>
        </div>
        <Link to={`/market/listing/${post.id}`} aria-label="Open post" className="p-1 text-slate-400 hover:text-slate-700">
          <MoreHorizontal className="w-5 h-5" />
        </Link>
      </header>

      {/* Text */}
      <div className="px-4 pt-2 space-y-1">
        <Link to={`/market/listing/${post.id}`} className="block text-[13px] font-bold text-slate-900 leading-snug hover:text-[#168821]">
          {post.title}
        </Link>
        <p className="text-xs text-slate-900 flex items-center flex-wrap gap-x-1.5">
          <span className="font-black text-[#0f5c18]">{priceLabel(post)}</span>
          {post.quantity != null && <span className="text-slate-500">· {qtyLabel(post.quantity, post.unit)}</span>}
          {post.negotiable && post.price != null && <span className="text-slate-400 text-[10px]">· negotiable</span>}
        </p>
        {post.description && (
          <p className={`text-[13px] text-slate-700 whitespace-pre-line break-words ${!expanded && longText ? "line-clamp-3" : ""}`}>
            {post.description}
          </p>
        )}
        {longText && !expanded && (
          <button onClick={() => setExpanded(true)} className="text-xs font-semibold text-slate-500 hover:text-[#168821] cursor-pointer">
            ...see more
          </button>
        )}
      </div>

      {/* Media: video first, otherwise the photo(s) */}
      {(video || photos.length > 0) && (
        <div className="mt-2.5 bg-slate-100">
          {video ? (
            <video src={mediaUrl(video.url)} controls playsInline preload="metadata"
              poster={photos[0] ? mediaUrl(photos[0].url) : undefined}
              className="w-full max-h-[70vh] bg-black" />
          ) : photos.length === 1 ? (
            <Link to={`/market/listing/${post.id}`}>
              <img src={mediaUrl(photos[0].url)} alt={post.title} loading="lazy" className="w-full max-h-[70vh] object-cover" />
            </Link>
          ) : (
            <Link to={`/market/listing/${post.id}`} className="grid grid-cols-2 gap-0.5">
              {photos.slice(0, 4).map((p, i) => (
                <div key={p.id} className="relative aspect-square">
                  <img src={mediaUrl(p.url)} alt="" loading="lazy" className="w-full h-full object-cover" />
                  {i === 3 && photos.length > 4 && (
                    <span className="absolute inset-0 bg-black/50 text-white text-xl font-black flex items-center justify-center">
                      +{photos.length - 4}
                    </span>
                  )}
                </div>
              ))}
            </Link>
          )}
        </div>
      )}

      <PostActions post={post} onChange={setPost} onCommentClick={() => setShowComments(true)} />
      {showComments && (
        <Comments post={post} autoFocus onCountChange={(n) => setPost((p) => ({ ...p, comment_count: n }))} />
      )}
    </article>
  );
}
