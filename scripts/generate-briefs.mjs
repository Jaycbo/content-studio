import fs from 'node:fs';
import path from 'node:path';

const historyPath = 'var/fyp-capture/HISTORY.json';
if (!fs.existsSync(historyPath)) {
  console.error("Missing var/fyp-capture/HISTORY.json. Run fyp-har-import first.");
  process.exit(1);
}

const history = JSON.parse(fs.readFileSync(historyPath, 'utf8'));
const nowMs = Date.now();
const qualifiedVideos = [];

for (const record of Object.values(history)) {
  const video = record.item;
  if (!video || !video.stats || !video.author) continue;
  if (video.isAd === true) continue;

  const desc = (video.desc || '').toLowerCase();
  const author = (video.author.uniqueId || '').toLowerCase();
  if (author.includes('capcut') || desc.includes('#capcut') || author.includes('ubereats')) continue;

  const views = video.stats.playCount || 0;
  const likes = video.stats.diggCount || 0;
  const comments = video.stats.commentCount || 0;
  const shares = video.stats.shareCount || 0;
  const erNum = views > 0 ? (likes / views) * 100 : 0;
  const followerCount = video.authorStats?.followerCount || 0;

  if (erNum < 2.5 || views < 50000) continue;

  const handle = `@${video.author.uniqueId}`;
  const createTimeSec = video.createTime || Math.floor(nowMs / 1000) - (86400 * 30);
  const ageDays = Math.max(0.1, (nowMs - (createTimeSec * 1000)) / (1000 * 60 * 60 * 24));
  const viewsPerDay = Math.round(views / ageDays);
  const shareRatio = views > 0 ? (shares / views) * 100 : 0;

  // Follower-to-View Benchmarking Multiplier
  let followerMultiplier = 1.0;
  let isCelebrity = false;
  let isUnderdog = false;
  let viewFollowerRatio = 0;

  if (followerCount > 2000000) {
    followerMultiplier = 0.8;
    isCelebrity = true;
  } else if (followerCount > 0 && followerCount < 50000) {
    viewFollowerRatio = views / followerCount;
    followerMultiplier = Math.min(1.5, 1.0 + (viewFollowerRatio * 0.05));
    if (followerMultiplier >= 1.2) isUnderdog = true;
  }

  // Viral Opportunity Score (0-100)
  const speedLog = Math.min(10, Math.log10(Math.max(1, viewsPerDay)));
  const normalizedSpeed = (speedLog / 7) * 25;
  const erPoints = Math.min(35, erNum * 3.5);
  const sharePoints = Math.min(40, shareRatio * 40);
  const rawScore = normalizedSpeed + erPoints + sharePoints;
  const opportunityScore = Math.min(99, Math.round(rawScore * followerMultiplier));

  let deltaText = "";
  let deltaPositive = false;
  const snaps = record.snapshots || [];
  if (snaps.length >= 2) {
    const oldest = snaps[0];
    const newest = snaps[snaps.length - 1];
    const diffViews = newest.views - oldest.views;
    const diffHours = Math.max(0.1, (newest.timestamp - oldest.timestamp) / (1000 * 60 * 60));

    if (diffViews > 0) {
      const viewsPerHour = Math.round(diffViews / diffHours);
      deltaPositive = true;
      deltaText = `+${diffViews >= 1000 ? Math.round(diffViews / 1000) + 'k' : diffViews} in ${Math.round(diffHours)}h (${viewsPerHour >= 1000 ? Math.round(viewsPerHour / 1000) + 'k' : viewsPerHour}/hr)`;
    } else {
      deltaText = "Stagnant";
    }
  }

  let signalTag = "STABLE";
  let signalColor = "gray";
  let recommendation = "Benchmark format";

  // Tiered Tagging Logic overrides
  if (isCelebrity) {
    signalTag = "💎 CELEBRITY";
    signalColor = "slate";
    recommendation = "Macro trend baseline — High absolute views driven by existing audience size.";
  } else if (isUnderdog) {
    signalTag = "🚀 UNDERDOG OUTLIER";
    signalColor = "orange";
    recommendation = `Massive reach for a small account (${viewFollowerRatio.toFixed(1)}x views-to-followers). Highly replicable.`;
  } else if (deltaPositive) {
    signalTag = "📈 ACCELERATING";
    signalColor = "red";
    recommendation = `Gaining traction fast! ${deltaText}`;
  } else if (ageDays <= 5 && viewsPerDay >= 100000 && erNum >= 4.0) {
    signalTag = "🚀 BREAKOUT VELOCITY";
    signalColor = "red";
    recommendation = "Trending NOW — High velocity + healthy engagement. Replicate within 24-48h";
  } else if (shareRatio >= 0.4 && views >= 300000 && erNum >= 3.5) {
    signalTag = "🔁 HIGH SHARE UTILITY";
    signalColor = "purple";
    recommendation = "High share rate — Viewers are DMing this to friends";
  } else if (erNum >= 9.0 && views >= 500000) {
    signalTag = "🔥 HIGH ENGAGEMENT";
    signalColor = "emerald";
    recommendation = "Magnetic hook — Retention and like ratio are far above average";
  } else if (views >= 2000000 && erNum >= 3.0) {
    signalTag = "🌲 EVERGREEN HIT";
    signalColor = "blue";
    recommendation = "Proven mass format — Reliable evergreen structure";
  }

  qualifiedVideos.push({
    id: video.id,
    viewsRaw: views,
    viewsPerDayRaw: viewsPerDay,
    erNum,
    shareRatioNum: shareRatio,
    opportunityScore,
    deltaText,
    signalTag,
    signalColor,
    recommendation,
    ageDays: Math.round(ageDays),
    ageDisplay: ageDays < 1 ? 'Today' : `${Math.round(ageDays)}d ago`,
    velocityDisplay: viewsPerDay >= 1000000 ? `${(viewsPerDay / 1000000).toFixed(1)}M/day` : `${Math.round(viewsPerDay / 1000)}k/day`,
    creator: {
      handle,
      nickname: video.author.nickname || video.author.uniqueId,
      avatar: video.author.avatarThumb || ''
    },
    metrics: {
      views: views >= 1000000 ? `${(views / 1000000).toFixed(1)}M` : views.toLocaleString(),
      followers: followerCount >= 1000000 ? `${(followerCount / 1000000).toFixed(1)}M` : (followerCount >= 1000 ? `${Math.round(followerCount / 1000)}k` : followerCount.toLocaleString()),
      likes: likes >= 1000000 ? `${(likes / 1000000).toFixed(1)}M` : `${Math.round(likes / 1000)}k`,
      comments: comments.toLocaleString(),
      shares: shares >= 1000 ? `${(shares / 1000).toFixed(1)}k` : shares.toLocaleString(),
      shareRate: `${shareRatio.toFixed(2)}%`,
      er: `${erNum.toFixed(1)}%`
    },
    caption: (video.desc || '').trim(),
    sound: {
      title: video.music?.title || 'Original Sound',
      author: video.music?.authorName || handle,
      url: video.music?.id ? `https://www.tiktok.com/music/-${video.music.id}` : null
    },
    media: {
      webUrl: `https://www.tiktok.com/${handle}/video/${video.id}`,
      coverUrl: video.video?.cover || video.video?.originCover || '',
      animatedCoverUrl: video.video?.dynamicCover || video.video?.animatedCover || video.video?.cover || ''
    }
  });
}

const outDir = 'var/briefs';
fs.mkdirSync(outDir, { recursive: true });
fs.readdirSync(outDir).forEach(f => fs.unlinkSync(`${outDir}/${f}`));

qualifiedVideos.forEach((record, idx) => {
  fs.writeFileSync(`${outDir}/video-${idx + 1}.json`, JSON.stringify(record, null, 2));
});

console.log(`Saved ${qualifiedVideos.length} qualified videos with Opportunity Scores.`);
