namespace WebinarApi.Services;

public interface ITranscriptionService
{
    Task<(bool success, string message, string? transcriptRelativePath)> TranscribeVideoAsync(
        string recordId,
        string videoRelativePath,
        CancellationToken cancellationToken = default);

    Task<(bool success, string? content)> ReadTranscriptContentAsync(string transcriptRelativePath);
}
