# 🥝 OpenAI Models Reference

## Models with Vision Support (Required for This App)

Your app uses screenshots/images, so you **must** use a model that supports vision.

### Recommended Models

| Model                    | Description               | Cost   | Speed     | Best For                          |
| ------------------------ | ------------------------- | ------ | --------- | --------------------------------- |
| **gpt-4o**               | Latest model, best vision | Medium | Fastest   | **Recommended** - Best balance    |
| **gpt-4o-mini**          | Faster, cheaper version   | Low    | Very Fast | Budget-conscious, still excellent |
| **gpt-4-turbo**          | Previous generation       | Medium | Fast      | Reliable, proven                  |
| **gpt-4-vision-preview** | Legacy vision model       | Medium | Medium    | Legacy support                    |

### Models WITHOUT Vision Support (Don't Use)

- ❌ `gpt-3.5-turbo` - Text only, no images
- ❌ `gpt-4` (base) - No vision support
- ❌ Any model without "vision" or "o" in the name

## How to Check Available Models

### Method 1: API Call

```bash
curl https://api.openai.com/v1/models \
  -H "Authorization: Bearer $OPENAI_API_KEY" | jq '.data[].id' | grep gpt
```

### Method 2: OpenAI Dashboard

- Go to https://platform.openai.com/playground
- Check the model dropdown to see available models

## Configuration

### Set Model in `.env.local`

```bash
# Use the latest recommended model
OPENAI_MODEL=gpt-4o

# Or use the cheaper option
OPENAI_MODEL=gpt-4o-mini

# Or use the previous generation
OPENAI_MODEL=gpt-4-turbo
```

### Default Behavior

If `OPENAI_MODEL` is not set, the app defaults to `gpt-4o`.

## Testing Your Setup

1. **Test in App:**
   - Create a new test in the dashboard
   - Start a test run
   - Check browser console for OpenAI API calls
   - Should see `[OpenAI] Making API call to gpt-4o with X messages`

## Common Errors

### 429 - Quota Exceeded

- **Cause:** No credits or exceeded usage limit
- **Fix:** Add credits at https://platform.openai.com/account/billing

### 401 - Invalid API Key

- **Cause:** Wrong or missing API key
- **Fix:** Check `OPENAI_API_KEY` in `.env.local`

### Model Not Found

- **Cause:** Model name is incorrect or not available for your account
- **Fix:** Use one of the recommended models above

## Cost Considerations

- **gpt-4o**: ~$2.50 per 1M input tokens, ~$10 per 1M output tokens
- **gpt-4o-mini**: ~$0.15 per 1M input tokens, ~$0.60 per 1M output tokens
- **gpt-4-turbo**: ~$10 per 1M input tokens, ~$30 per 1M output tokens

For this app (screenshots + AI agent), expect:

- ~50-200 tokens per screenshot analysis
- ~100-500 tokens per response
- Cost per test run: $0.01 - $0.10 (depending on model and test length)

## Resources

- [OpenAI Models Documentation](https://platform.openai.com/docs/models)
- [OpenAI Pricing](https://openai.com/api/pricing/)
- [Vision Capabilities](https://platform.openai.com/docs/guides/vision)
