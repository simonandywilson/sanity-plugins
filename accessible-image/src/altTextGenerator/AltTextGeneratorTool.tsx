import React, {useState, useEffect, useCallback} from "react";
import {useClient} from "sanity";
import {
  Badge,
  Box,
  Button,
  Card,
  Checkbox,
  Container,
  Dialog,
  Flex,
  Grid,
  Label,
  Select,
  Spinner,
  Stack,
  Text,
  TextArea,
  TextInput,
  useToast,
} from "@sanity/ui";
import {SparklesIcon, RefreshIcon, CogIcon, CheckmarkIcon, CloseIcon, AddIcon} from "@sanity/icons";
import imageUrlBuilder from "@sanity/image-url";
import {
  generateAltText,
  fetchOpenAIModels,
  OPENAI_MODELS,
  ANTHROPIC_MODELS,
  GEMINI_MODELS,
  type AIProvider,
  type ModelOption,
} from "./generateAltText";

interface ImageAsset {
  _id: string;
  url: string;
  altText?: string;
  metadata?: {
    dimensions?: {
      width: number;
      height: number;
    };
  };
  originalFilename?: string;
}

interface GeneratedAltText {
  imageId: string;
  altText: string;
  status: "pending" | "accepted" | "declined";
}

const SETTINGS_ID = "altTextGeneratorSettings";

export function AltTextGeneratorTool() {
  const client = useClient({apiVersion: "2024-01-01"});
  const toast = useToast();
  const builder = imageUrlBuilder(client);

  const [provider, setProvider] = useState<AIProvider>("openai");
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState("gpt-4o-mini");
  const [globalContext, setGlobalContext] = useState("");
  const [recentContexts, setRecentContexts] = useState<string[]>([]);
  const [images, setImages] = useState<ImageAsset[]>([]);
  const [loading, setLoading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [processedCount, setProcessedCount] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [settingsSaved, setSettingsSaved] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [models, setModels] = useState<ModelOption[]>(OPENAI_MODELS);
  const [loadingModels, setLoadingModels] = useState(false);
  const [selectedImages, setSelectedImages] = useState<Set<string>>(new Set());
  const [contextText, setContextText] = useState("");
  const [generatedAltTexts, setGeneratedAltTexts] = useState<Map<string, GeneratedAltText>>(
    new Map(),
  );
  const [showReviewDialog, setShowReviewDialog] = useState(false);
  const [showContextDialog, setShowContextDialog] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [regeneratingImageId, setRegeneratingImageId] = useState<string | null>(null);

  useEffect(() => {
    loadSettings();
    fetchImagesWithoutAltText(false);
  }, []);

  useEffect(() => {
    if (provider === "openai" && apiKey && !loadingModels) {
      handleFetchModels();
    }
  }, [apiKey, provider]);

  const loadSettings = async () => {
    try {
      const settings = await client.fetch(
        `*[_id == "${SETTINGS_ID}"][0]{ provider, apiKey, model, globalContext, recentContexts }`,
      );

      if (settings?.apiKey) {
        setProvider(settings.provider || "openai");
        setApiKey(settings.apiKey);
        setModel(settings.model || "gpt-4o-mini");
        setGlobalContext(settings.globalContext || "");
        setRecentContexts(settings.recentContexts || []);
        setSettingsSaved(true);

        if (settings.provider === "anthropic") {
          setModels(ANTHROPIC_MODELS);
        } else if (settings.provider === "gemini") {
          setModels(GEMINI_MODELS);
        }
      }
    } catch (error) {
      console.error("Error loading settings:", error);
    }
  };

  const saveSettings = async () => {
    if (!apiKey) {
      toast.push({
        status: "warning",
        title: "API Key Required",
        description: "Please enter an API key before saving",
      });
      return;
    }

    try {
      await client.createOrReplace({
        _type: "altTextGeneratorSettings",
        _id: SETTINGS_ID,
        provider,
        apiKey,
        model,
        globalContext,
        recentContexts,
      });

      setSettingsSaved(true);
      toast.push({
        status: "success",
        title: "Settings Saved",
      });
    } catch (error: any) {
      console.error("Error saving settings:", error);
      toast.push({
        status: "error",
        title: "Error Saving Settings",
        description: error.message || "Failed to save settings",
      });
    }
  };

  const handleFetchModels = async () => {
    if (!apiKey || provider !== "openai") return;

    setLoadingModels(true);
    try {
      const fetched = await fetchOpenAIModels(apiKey);
      setModels(fetched);
    } catch (error: any) {
      console.error("Error fetching models:", error);
      setModels(OPENAI_MODELS);
    } finally {
      setLoadingModels(false);
    }
  };

  const handleProviderChange = (newProvider: AIProvider) => {
    setProvider(newProvider);
    setSettingsSaved(false);

    if (newProvider === "openai") {
      setModels(OPENAI_MODELS);
      setModel("gpt-4o-mini");
    } else if (newProvider === "anthropic") {
      setModels(ANTHROPIC_MODELS);
      setModel("claude-sonnet-4-20250514");
    } else {
      setModels(GEMINI_MODELS);
      setModel("gemini-2.5-flash");
    }
  };

  const fetchImagesWithoutAltText = async (showToast = true) => {
    setLoading(true);
    try {
      const result = await client.fetch<ImageAsset[]>(
        `*[_type == "sanity.imageAsset" && !defined(altText)] | order(_createdAt desc) {
          _id, url, altText, metadata, originalFilename
        }`,
      );
      setImages(result);
      setTotalCount(result.length);
      setSelectedImages(new Set());

      if (showToast) {
        toast.push({
          status: "success",
          title: `Found ${result.length} image${result.length !== 1 ? "s" : ""} without alt text`,
        });
      }
    } catch (error: any) {
      toast.push({status: "error", title: "Error fetching images", description: error.message});
    } finally {
      setLoading(false);
    }
  };

  const toggleImageSelection = (imageId: string) => {
    setSelectedImages((prev) => {
      const next = new Set(prev);
      if (next.has(imageId)) {
        next.delete(imageId);
      } else {
        next.add(imageId);
      }
      return next;
    });
  };

  const generateForImage = useCallback(
    async (imageAsset: ImageAsset) => {
      const imageUrl = builder.image(imageAsset).width(800).url();
      const combinedContext = [globalContext, contextText].filter(Boolean).join("\n\n");

      return generateAltText({
        imageUrl,
        apiKey,
        model,
        provider,
        context: combinedContext || undefined,
      });
    },
    [apiKey, model, provider, globalContext, contextText],
  );

  const processSelectedImages = async () => {
    if (!apiKey) {
      toast.push({
        status: "error",
        title: "API Key Required",
        description: `Please enter your ${provider === "openai" ? "OpenAI" : provider === "anthropic" ? "Anthropic" : "Google Gemini"} API key`,
      });
      return;
    }

    const imagesToProcess =
      selectedImages.size > 0 ? images.filter((img) => selectedImages.has(img._id)) : images;

    if (imagesToProcess.length === 0) {
      toast.push({
        status: "warning",
        title: "No Images",
        description: "No images to process",
      });
      return;
    }

    setProcessing(true);
    setProcessedCount(0);
    setTotalCount(imagesToProcess.length);
    const newGeneratedTexts = new Map<string, GeneratedAltText>();
    let successCount = 0;
    let errorCount = 0;

    for (let i = 0; i < imagesToProcess.length; i++) {
      const image = imagesToProcess[i];
      try {
        const altText = await generateForImage(image);
        newGeneratedTexts.set(image._id, {imageId: image._id, altText, status: "pending"});
        successCount++;
      } catch (error: any) {
        errorCount++;
        console.error(`Error processing image ${image._id}:`, error);
      }
      setProcessedCount(i + 1);
    }

    setProcessing(false);

    if (successCount > 0) {
      setGeneratedAltTexts(newGeneratedTexts);
      setShowReviewDialog(true);

      if (contextText?.trim()) {
        saveContextToRecent(contextText);
      }

      toast.push({
        status: "success",
        title: "Alt Text Generated",
        description: `Generated for ${successCount} image${successCount !== 1 ? "s" : ""}${errorCount > 0 ? `. ${errorCount} failed.` : ""}`,
      });
    } else {
      toast.push({
        status: "error",
        title: "Generation Failed",
        description: "Failed to generate alt text. Check console for details.",
      });
    }
  };

  const regenerateOne = async (imageId: string) => {
    const image = images.find((img) => img._id === imageId);
    if (!image) return;

    setRegeneratingImageId(imageId);
    try {
      const altText = await generateForImage(image);
      setGeneratedAltTexts((prev) => {
        const next = new Map(prev);
        next.set(imageId, {imageId, altText, status: "pending"});
        return next;
      });
    } catch (error: any) {
      toast.push({status: "error", title: "Regeneration Failed", description: error.message});
    } finally {
      setRegeneratingImageId(null);
    }
  };

  const updateGeneratedText = (imageId: string, newAltText: string) => {
    setGeneratedAltTexts((prev) => {
      const next = new Map(prev);
      const existing = next.get(imageId);
      if (existing) next.set(imageId, {...existing, altText: newAltText});
      return next;
    });
  };

  const acceptAltText = (imageId: string) => {
    setGeneratedAltTexts((prev) => {
      const next = new Map(prev);
      const existing = next.get(imageId);
      if (existing) next.set(imageId, {...existing, status: "accepted"});
      return next;
    });
  };

  const declineAltText = (imageId: string) => {
    setGeneratedAltTexts((prev) => {
      const next = new Map(prev);
      next.delete(imageId);
      return next;
    });
  };

  const commitAllAltTexts = async () => {
    const textsToCommit = Array.from(generatedAltTexts.values()).filter(
      (item) => item.status === "accepted" || item.status === "pending",
    );

    if (textsToCommit.length === 0) {
      toast.push({
        status: "warning",
        title: "No Alt Text to Commit",
        description: "Accept some entries before committing",
      });
      return;
    }

    setCommitting(true);
    let successCount = 0;
    let errorCount = 0;

    for (const item of textsToCommit) {
      try {
        await client.patch(item.imageId).set({altText: item.altText}).commit();
        successCount++;
      } catch (error: any) {
        errorCount++;
        console.error(`Error committing alt text for ${item.imageId}:`, error);
      }
    }

    setCommitting(false);
    setShowReviewDialog(false);
    setGeneratedAltTexts(new Map());
    setSelectedImages(new Set());
    setContextText("");

    if (successCount > 0) {
      toast.push({
        status: "success",
        title: "Alt Text Committed",
        description: `Saved ${successCount} alt text${successCount !== 1 ? "s" : ""}${errorCount > 0 ? `. ${errorCount} failed.` : ""}`,
      });
      fetchImagesWithoutAltText();
    } else {
      toast.push({
        status: "error",
        title: "Commit Failed",
        description: "Failed to save alt text.",
      });
    }
  };

  const saveContextToRecent = async (context: string) => {
    if (!context?.trim()) return;
    const newRecentContexts = [context, ...recentContexts.filter((c) => c !== context)].slice(0, 5);
    setRecentContexts(newRecentContexts);

    try {
      await client.createOrReplace({
        _type: "altTextGeneratorSettings",
        _id: SETTINGS_ID,
        provider,
        apiKey,
        model,
        globalContext,
        recentContexts: newRecentContexts,
      });
    } catch (error) {
      console.error("Error saving recent contexts:", error);
    }
  };

  const cancelReview = () => {
    setShowReviewDialog(false);
    setGeneratedAltTexts(new Map());
  };

  return (
    <Flex direction="column" height="fill">
      {/* Header */}
      <Card borderBottom padding={3}>
        <Container width={2}>
          <Flex align="center" justify="space-between">
            <Flex align="center" gap={3}>
              <Text size={2} weight="semibold">
                AI Alt Text
              </Text>
              {processing ? (
                <>
                  <Spinner />
                  <Text size={1}>
                    Generating... {processedCount} of {totalCount}
                  </Text>
                </>
              ) : (
                !loading &&
                images.length > 0 && (
                  <>
                    <Badge tone="primary">{images.length} images found</Badge>
                    {selectedImages.size > 0 && (
                      <Badge tone="positive">{selectedImages.size} selected</Badge>
                    )}
                  </>
                )
              )}
            </Flex>
            <Flex gap={2}>
              <Button
                icon={CogIcon}
                mode="ghost"
                onClick={() => setShowSettings(!showSettings)}
                selected={showSettings}
                title="Settings"
              />
              <Button
                icon={RefreshIcon}
                mode="ghost"
                onClick={() => fetchImagesWithoutAltText()}
                disabled={loading || processing}
                title="Refresh"
              />
              {images.length > 0 && (
                <>
                  <Button
                    icon={AddIcon}
                    text={
                      contextText
                        ? `Edit Context (${selectedImages.size})`
                        : `Add Context (${selectedImages.size})`
                    }
                    mode="ghost"
                    onClick={() => setShowContextDialog(true)}
                    disabled={processing || selectedImages.size === 0}
                    tone={contextText ? "primary" : undefined}
                  />
                  <Button
                    icon={SparklesIcon}
                    text={
                      processing
                        ? `${processedCount}/${totalCount}`
                        : selectedImages.size > 0
                          ? `Generate (${selectedImages.size})`
                          : "Generate All"
                    }
                    tone="primary"
                    onClick={processSelectedImages}
                    disabled={processing || !apiKey}
                    loading={processing}
                  />
                </>
              )}
            </Flex>
          </Flex>
        </Container>
      </Card>

      {/* Settings Panel */}
      {showSettings && (
        <Card borderBottom padding={4} tone="transparent">
          <Container width={2}>
            <Stack space={4}>
              <Text size={1} muted>
                Settings are saved and will persist between sessions
              </Text>
              <Stack space={3}>
                <Stack space={2}>
                  <Label size={1}>AI Provider</Label>
                  <Select
                    value={provider}
                    onChange={(e) =>
                      handleProviderChange(e.currentTarget.value as AIProvider)
                    }
                    fontSize={1}
                  >
                    <option value="openai">OpenAI</option>
                    <option value="anthropic">Anthropic</option>
                    <option value="gemini">Google Gemini</option>
                  </Select>
                </Stack>

                <Stack space={2}>
                  <Label size={1}>
                    {provider === "openai" ? "OpenAI" : provider === "anthropic" ? "Anthropic" : "Google Gemini"} API Key
                  </Label>
                  <TextInput
                    type="password"
                    placeholder={provider === "openai" ? "sk-..." : provider === "anthropic" ? "sk-ant-..." : "AIza..."}
                    value={apiKey}
                    onChange={(e) => {
                      setApiKey(e.currentTarget.value);
                      setSettingsSaved(false);
                    }}
                    fontSize={1}
                  />
                </Stack>

                <Stack space={2}>
                  <Label size={1}>Model</Label>
                  <Flex align="center" justify="space-between" gap={2}>
                    <Select
                      value={model}
                      onChange={(e) => {
                        setModel(e.currentTarget.value);
                        setSettingsSaved(false);
                      }}
                      fontSize={1}
                      disabled={!apiKey || loadingModels}
                    >
                      {models.map((m) => (
                        <option key={m.value} value={m.value}>
                          {m.title}
                        </option>
                      ))}
                    </Select>
                    {provider === "openai" && (
                      <Button
                        text="Fetch Latest"
                        mode="ghost"
                        fontSize={1}
                        onClick={handleFetchModels}
                        disabled={!apiKey || loadingModels}
                        loading={loadingModels}
                      />
                    )}
                  </Flex>
                </Stack>

                <Stack space={2}>
                  <Label size={1}>Global Context (optional)</Label>
                  <TextArea
                    placeholder="Add default context applied to all images (e.g., ‘Images from a design portfolio’)"
                    value={globalContext}
                    onChange={(e) => {
                      setGlobalContext(e.currentTarget.value);
                      setSettingsSaved(false);
                    }}
                    rows={3}
                    fontSize={1}
                  />
                  <Text size={0} muted>
                    This context will be included in every alt text generation prompt.
                  </Text>
                </Stack>
              </Stack>

              <Flex gap={2}>
                <Button
                  text={settingsSaved ? "Saved" : "Save Settings"}
                  tone={settingsSaved ? "positive" : "primary"}
                  onClick={saveSettings}
                  disabled={!apiKey || settingsSaved}
                  fontSize={1}
                />
              </Flex>
            </Stack>
          </Container>
        </Card>
      )}

      {/* Content Area */}
      <Box flex={1} overflow="auto">
        <Container width={2} paddingTop={4} paddingBottom={4}>
          {loading ? (
            <Flex align="center" justify="center" padding={6}>
              <Spinner size={3} />
            </Flex>
          ) : images.length === 0 ? (
            <Card padding={5} radius={2} tone="transparent" border>
              <Flex direction="column" align="center" justify="center" gap={3}>
                <Stack space={2}>
                  <Text size={1} weight="semibold" align="center">
                    All images have alt text
                  </Text>
                  <Text size={1} muted align="center">
                    All your images are properly described.
                  </Text>
                </Stack>
              </Flex>
            </Card>
          ) : (
            <Stack space={4}>
              {processing && (
                <Card padding={3} radius={2} tone="primary">
                  <Flex align="center" gap={3}>
                    <Spinner />
                    <Text size={1}>
                      Generating alt text... {processedCount} of {totalCount}
                    </Text>
                  </Flex>
                </Card>
              )}

              <Grid columns={[2, 3, 4, 5]} gap={5}>
                {images.map((image) => {
                  const isSelected = selectedImages.has(image._id);
                  return (
                    <Flex direction="column" gap={2} justify="flex-end" key={image._id}>
                      <Card
                        radius={2}
                        style={{
                          overflow: "hidden",
                          cursor: "pointer",
                          boxShadow: isSelected ? "0 0 0 0 calc(1px) red" : "unset",
                        }}
                        onClick={() => toggleImageSelection(image._id)}
                      >
                        <img
                          src={builder.image(image).width(300).url()}
                          alt=""
                          style={{width: "100%", objectFit: "contain", display: "block"}}
                        />
                      </Card>
                      <Flex
                        align="center"
                        gap={2}
                        style={{textOverflow: "ellipsis", width: "80%"}}
                      >
                        <Checkbox
                          checked={isSelected}
                          onChange={() => toggleImageSelection(image._id)}
                          style={{pointerEvents: "none"}}
                        />
                        <Text size={0} muted textOverflow="ellipsis" style={{width: "100%"}}>
                          {image?.originalFilename ?? ""}
                        </Text>
                      </Flex>
                    </Flex>
                  );
                })}
              </Grid>

              {!apiKey && (
                <Card padding={3} radius={2} tone="caution">
                  <Text size={1}>
                    Configure your API key in settings to generate alt text.
                  </Text>
                </Card>
              )}
            </Stack>
          )}
        </Container>
      </Box>

      {/* Context Dialog */}
      {showContextDialog && (
        <Dialog
          header="Add Context"
          id="context-dialog"
          onClose={() => setShowContextDialog(false)}
          width={1}
        >
          <Box padding={4}>
            <Stack space={4}>
              <Stack space={3}>
                <Stack space={2}>
                  <Label size={1}>Batch Context (optional)</Label>
                  <TextArea
                    placeholder="Add specific context for this batch of images"
                    value={contextText}
                    onChange={(e) => setContextText(e.currentTarget.value)}
                    rows={4}
                    fontSize={1}
                  />
                  {globalContext && (
                    <Badge size={0} tone="caution" style={{width: "max-content"}}>
                      Global context from settings will also be included
                    </Badge>
                  )}
                </Stack>

                {recentContexts.length > 0 && (
                  <Stack space={2}>
                    <Label size={0}>Recent Contexts</Label>
                    <Flex gap={2} wrap="wrap">
                      {recentContexts.map((context, index) => (
                        <Button
                          key={index}
                          text={context.length > 40 ? `${context.slice(0, 40)}...` : context}
                          mode="ghost"
                          fontSize={0}
                          onClick={() => setContextText(context)}
                          tone={contextText === context ? "primary" : undefined}
                        />
                      ))}
                    </Flex>
                  </Stack>
                )}
              </Stack>

              <Flex gap={2} justify="space-between">
                <Box>
                  {contextText && (
                    <Button
                      text="Clear Context"
                      mode="ghost"
                      tone="critical"
                      onClick={() => setContextText("")}
                    />
                  )}
                </Box>
                <Flex gap={2}>
                  <Button text="Cancel" mode="ghost" onClick={() => setShowContextDialog(false)} />
                  <Button
                    text={
                      selectedImages.size > 0
                        ? `Generate (${selectedImages.size})`
                        : "Generate All"
                    }
                    tone="primary"
                    icon={SparklesIcon}
                    onClick={() => {
                      setShowContextDialog(false);
                      processSelectedImages();
                    }}
                    disabled={!apiKey}
                  />
                </Flex>
              </Flex>
            </Stack>
          </Box>
        </Dialog>
      )}

      {/* Review Dialog */}
      {showReviewDialog && (
        <Dialog
          header="Review Generated Alt Text"
          id="review-dialog"
          onClose={cancelReview}
          width={2}
        >
          <Box padding={4}>
            <Stack space={4}>
              <Flex align="center" justify="space-between">
                <Badge tone="primary">
                  {generatedAltTexts.size} image{generatedAltTexts.size !== 1 ? "s" : ""}
                </Badge>

                <Flex gap={2}>
                  <Button
                    text="Accept All"
                    mode="ghost"
                    fontSize={1}
                    onClick={() => {
                      Array.from(generatedAltTexts.keys()).forEach((id) => acceptAltText(id));
                    }}
                  />
                  <Button
                    text={`Commit ${
                      Array.from(generatedAltTexts.values()).filter(
                        (item) => item.status === "accepted" || item.status === "pending",
                      ).length
                    }`}
                    tone="primary"
                    onClick={commitAllAltTexts}
                    disabled={committing}
                    loading={committing}
                  />
                </Flex>
              </Flex>

              <Stack space={3}>
                {Array.from(generatedAltTexts.entries()).map(([imageId, generated]) => {
                  const image = images.find((img) => img._id === imageId);
                  if (!image) return null;

                  const isAccepted = generated.status === "accepted";

                  return (
                    <Card
                      key={imageId}
                      padding={3}
                      radius={2}
                      tone={isAccepted ? "positive" : "default"}
                      border
                    >
                      <Flex gap={3} align="center" justify="center">
                        <Box style={{flexShrink: 0, width: "120px", height: "120px"}}>
                          <img
                            src={builder.image(image).width(240).url()}
                            alt=""
                            style={{
                              width: "100%",
                              height: "100%",
                              objectFit: "contain",
                              objectPosition: "center",
                            }}
                          />
                        </Box>

                        <Stack space={3} flex={1}>
                          <Stack space={2} flex={1}>
                            <Label size={0}>Generated Alt Text</Label>
                            <TextArea
                              value={generated.altText}
                              onChange={(e) =>
                                updateGeneratedText(imageId, e.currentTarget.value)
                              }
                              rows={3}
                              fontSize={1}
                            />
                          </Stack>

                          <Flex gap={2}>
                            {!isAccepted ? (
                              <>
                                <Button
                                  text="Accept"
                                  tone="positive"
                                  fontSize={1}
                                  icon={CheckmarkIcon}
                                  disabled={regeneratingImageId === imageId || committing}
                                  onClick={() => acceptAltText(imageId)}
                                />
                                <Button
                                  text={
                                    regeneratingImageId === imageId
                                      ? "Regenerating..."
                                      : "Regenerate"
                                  }
                                  mode="ghost"
                                  fontSize={1}
                                  icon={RefreshIcon}
                                  loading={regeneratingImageId === imageId}
                                  disabled={regeneratingImageId === imageId || committing}
                                  onClick={() => regenerateOne(imageId)}
                                />
                                <Button
                                  text="Decline"
                                  mode="ghost"
                                  tone="critical"
                                  fontSize={1}
                                  icon={CloseIcon}
                                  disabled={regeneratingImageId === imageId || committing}
                                  onClick={() => declineAltText(imageId)}
                                />
                              </>
                            ) : (
                              <>
                                <Badge
                                  tone="positive"
                                  fontSize={1}
                                  style={{
                                    alignContent: "center",
                                    justifyItems: "center",
                                    minWidth: "3rem",
                                    paddingLeft: "0.5rem",
                                    paddingRight: "0.5rem",
                                  }}
                                >
                                  Accepted
                                </Badge>
                                <Button
                                  text="Undo"
                                  mode="ghost"
                                  fontSize={1}
                                  onClick={() => {
                                    setGeneratedAltTexts((prev) => {
                                      const next = new Map(prev);
                                      const existing = next.get(imageId);
                                      if (existing)
                                        next.set(imageId, {...existing, status: "pending"});
                                      return next;
                                    });
                                  }}
                                />
                              </>
                            )}
                          </Flex>

                          {image.originalFilename && (
                            <Text size={0} muted>
                              {image.originalFilename}
                            </Text>
                          )}
                        </Stack>
                      </Flex>
                    </Card>
                  );
                })}
              </Stack>
            </Stack>
          </Box>
        </Dialog>
      )}
    </Flex>
  );
}
