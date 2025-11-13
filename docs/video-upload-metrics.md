# Video Upload Performance Metrics

Comprehensive performance metrics tracking for the video upload pipeline, designed for CloudWatch integration and performance optimization.

## Overview

The video upload metrics system tracks detailed performance data for every video upload operation, enabling:

- Performance optimization and bottleneck identification
- Upload success rate monitoring
- Bandwidth utilization analysis
- Transcoding performance tracking
- Retry behavior analysis

## Metrics Tracked

### 1. Upload Duration (`UploadDuration`)

**Description**: Total time from upload start to completion (including transcoding)

**Unit**: Milliseconds

**Dimensions**:

- `Status`: Success | Error
- `MimeType`: video/mp4, video/quicktime, etc.

**Use Cases**:

- Identify slow uploads
- Track P50, P95, P99 latency
- Compare performance across video types

### 2. Bandwidth Utilization (`BandwidthUtilization`)

**Description**: Upload speed in bytes per second

**Unit**: Bytes/Second

**Dimensions**:

- `Status`: Success | Error

**Calculation**: `totalBytes / uploadDurationMs * 1000`

**Use Cases**:

- Network performance analysis
- Identify bandwidth bottlenecks
- Compare upload speeds across sessions

### 3. Transcoding Wait Time (`TranscodingWaitTime`)

**Description**: Time spent waiting for video processing to complete

**Unit**: Milliseconds

**Dimensions**:

- `Status`: Success | Error

**Use Cases**:

- Identify transcoding bottlenecks
- Optimize polling intervals
- Track processing queue delays

### 4. Retry Attempts (`RetryAttempts`)

**Description**: Number of retry attempts before success or failure

**Unit**: Count

**Dimensions**:

- `Status`: Success | Error

**Use Cases**:

- Track retry rate trends
- Identify flaky network conditions
- Optimize retry strategies

### 5. Upload Success Rate (`UploadCount`)

**Description**: Success vs failure count per session

**Unit**: Count

**Dimensions**:

- `Status`: Success | Error
- `ErrorType`: Timeout, RateLimit, Authentication, ServerError, NetworkError, ProcessingError, Unknown

**Use Cases**:

- Monitor overall upload reliability
- Identify common failure patterns
- Alert on degraded service

### 6. Chunk Size Distribution (Future)

**Description**: Distribution of upload chunk sizes

**Unit**: Bytes

**Metrics**: Min, Max, Average, Median, P95, P99

**Use Cases**:

- Optimize chunking strategy
- Balance memory vs network efficiency

## Implementation

### Basic Usage

```typescript
import { VideoUploadService } from "./services/atproto/video-upload";
import { BskyAgent } from "@atproto/api";

const agent = new BskyAgent({ service: "https://bsky.social" });
const videoService = new VideoUploadService(agent);

// Metrics are automatically tracked during upload
const result = await videoService.uploadVideo(
  videoData,
  "video/mp4",
  (progress) => console.log(`Progress: ${progress}%`),
);
```

### Session Statistics

```typescript
import { getVideoUploadSessionStats } from "./utils/video-upload-metrics";

// Get comprehensive session statistics
const stats = getVideoUploadSessionStats();

console.log("Session Statistics:", {
  successRate: stats.successRate,
  totalUploads: stats.session.uploads.length,
  averageUploadDuration: stats.session.averageUploadDuration,
  percentiles: stats.percentiles,
});
```

### Manual Tracking (Advanced)

```typescript
import { getVideoUploadMetricsTracker } from "./utils/video-upload-metrics";

const tracker = getVideoUploadMetricsTracker();

// Start tracking
const uploadId = tracker.startUpload("video/mp4", 5000000);

// Track retry
tracker.trackRetry(uploadId);

// Track transcoding
tracker.startTranscoding(uploadId);
tracker.completeTranscoding(uploadId, 10); // 10 polling attempts

// Complete upload
tracker.completeUpload(uploadId, "video-id-123");

// Or mark as failed
tracker.failUpload(uploadId, new Error("Upload failed"));
```

## Metric Structure

### CloudWatch-Compatible Format

All metrics are logged in a structured format compatible with CloudWatch Logs Insights:

```json
{
  "timestamp": "2025-11-13T22:30:15.123Z",
  "namespace": "ShadowSky/VideoUpload",
  "metrics": {
    "UploadDuration": {
      "value": 15234,
      "unit": "Milliseconds",
      "dimensions": {
        "Status": "Success",
        "MimeType": "video/mp4"
      }
    },
    "BandwidthUtilization": {
      "value": 327680,
      "unit": "Bytes/Second",
      "dimensions": {
        "Status": "Success"
      }
    },
    "TranscodingWaitTime": {
      "value": 8500,
      "unit": "Milliseconds",
      "dimensions": {
        "Status": "Success"
      }
    },
    "RetryAttempts": {
      "value": 1,
      "unit": "Count",
      "dimensions": {
        "Status": "Success"
      }
    }
  },
  "context": {
    "uploadId": "upload_1699900215123_abc123",
    "totalBytes": 5000000,
    "averageChunkSize": 5000000,
    "pollingAttempts": 10
  }
}
```

## Percentile Statistics

The metrics tracker automatically calculates percentile statistics for:

- **Upload Duration**: P50, P95, P99
- **Bandwidth**: P50, P95, P99
- **Transcoding Wait Time**: P50, P95, P99

Example output:

```typescript
{
  duration: {
    p50: 12000,  // 50% of uploads complete in 12s or less
    p95: 25000,  // 95% of uploads complete in 25s or less
    p99: 45000   // 99% of uploads complete in 45s or less
  },
  bandwidth: {
    p50: 250000,  // 250 KB/s median
    p95: 500000,  // 500 KB/s at 95th percentile
    p99: 750000   // 750 KB/s at 99th percentile
  },
  transcodingWaitTime: {
    p50: 8000,   // 8s median transcoding time
    p95: 15000,  // 15s at 95th percentile
    p99: 30000   // 30s at 99th percentile
  }
}
```

## Error Categorization

Errors are automatically categorized for analysis:

| Error Type        | Description                   | HTTP Status |
| ----------------- | ----------------------------- | ----------- |
| `Timeout`         | Upload or transcoding timeout | N/A         |
| `RateLimit`       | Rate limit exceeded           | 429         |
| `Authentication`  | Auth token invalid/expired    | 401         |
| `Authorization`   | Insufficient permissions      | 403         |
| `ServerError`     | Bluesky server error          | 500, 503    |
| `NetworkError`    | Network connection failure    | N/A         |
| `ProcessingError` | Video processing failed       | N/A         |
| `Unknown`         | Unclassified error            | Various     |

## CloudWatch Dashboard Integration

### Backend Integration (Future)

To send metrics to CloudWatch, create a backend endpoint:

```typescript
// POST /api/metrics
app.post("/api/metrics", async (req, res) => {
  const metrics = req.body;

  await cloudwatch.putMetricData({
    Namespace: metrics.namespace,
    MetricData: Object.entries(metrics.metrics).map(([name, data]) => ({
      MetricName: name,
      Value: data.value,
      Unit: data.unit,
      Timestamp: new Date(metrics.timestamp),
      Dimensions: Object.entries(data.dimensions).map(([key, value]) => ({
        Name: key,
        Value: value,
      })),
    })),
  });

  res.json({ success: true });
});
```

### CloudWatch Logs Insights Queries

```sql
-- Average upload duration by status
fields @timestamp, metrics.UploadDuration.value as duration, metrics.UploadDuration.dimensions.Status as status
| filter namespace = "ShadowSky/VideoUpload"
| stats avg(duration) by status

-- P95 upload duration over time
fields @timestamp, metrics.UploadDuration.value as duration
| filter namespace = "ShadowSky/VideoUpload"
| stats percentile(duration, 95) by bin(5m)

-- Error rate by type
fields @timestamp, metrics.UploadCount.dimensions.ErrorType as errorType
| filter namespace = "ShadowSky/VideoUpload" and metrics.UploadCount.dimensions.Status = "Error"
| stats count() by errorType

-- Bandwidth utilization trends
fields @timestamp, metrics.BandwidthUtilization.value / 1048576 as bandwidthMBps
| filter namespace = "ShadowSky/VideoUpload"
| stats avg(bandwidthMBps), percentile(bandwidthMBps, 50), percentile(bandwidthMBps, 95) by bin(5m)
```

## Performance Optimization Recommendations

### Based on Upload Duration

- **High P99**: Investigate timeout issues, optimize retry strategy
- **High variance**: Network instability, consider adaptive chunk sizing
- **Consistent slow uploads**: Server-side bottleneck, consider CDN

### Based on Bandwidth Utilization

- **Low bandwidth**: Network constraints, recommend WiFi/better connection
- **High variability**: Unstable connection, increase retry tolerance
- **Declining trend**: Network congestion, schedule uploads off-peak

### Based on Transcoding Wait Time

- **Long wait times**: Processing queue delays, inform user expectations
- **Increasing trend**: Service degradation, alert monitoring
- **Timeouts**: Increase polling timeout, improve error handling

### Based on Retry Attempts

- **High retry rate**: Network reliability issues, adjust retry backoff
- **Specific error patterns**: Target error-specific optimizations
- **Increasing trend**: Service issues, alert operations team

## Testing

Run the test suite:

```bash
npm run test:unit
```

The test suite includes:

- Upload lifecycle tracking
- Retry attempt counting
- Transcoding time measurement
- Bandwidth calculation
- Error categorization
- Percentile calculation
- Session statistics
- Success rate calculation

## Future Enhancements

1. **Chunked Upload Support**: Track individual chunk performance
2. **Network Type Detection**: Correlate metrics with WiFi/cellular
3. **Device Performance**: Track by device capabilities
4. **Real-time Alerting**: Immediate alerts on degraded performance
5. **A/B Testing**: Compare different upload strategies
6. **Historical Trending**: Long-term performance analysis
7. **User-level Metrics**: Per-user upload success rates
8. **Geographic Analysis**: Performance by region

## References

- Video upload implementation: `/src/services/atproto/video-upload.ts`
- Metrics tracking utility: `/src/utils/video-upload-metrics.ts`
- CloudWatch metrics utility: `/amplify/functions/shared/cloudwatch-metrics.ts`
- Retry utility: `/src/utils/retry.ts`
