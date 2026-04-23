import {
  db,
  aiProvidersTable,
  aiProviderModelsTable,
  aiServiceAssignmentsTable,
} from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { logger } from "./logger";

interface ProviderSeed {
  type: "openrouter" | "custom";
  name: string;
  baseUrl: string;
  apiKey: string;
  models: Array<{
    modelId: string;
    label: string;
    capabilities: string;
  }>;
  serviceAssignments?: Array<{
    serviceName: string;
    modelIdIndex: number;
  }>;
}

const DEFAULT_PROVIDERS: ProviderSeed[] = [
  {
    type: "custom",
    name: "Nano Banana — 4K Media Live",
    baseUrl: "https://apikey.4kmedialive.com/api/nanobanana/v1",
    apiKey: "sk-119b6e6a2d7033297d5ee264eedf31d5a1afb507e9b574aaac00d3c1e99c3b87",
    models: [
      {
        modelId: "nano-banana",
        label: "Nano Banana (Flux.1)",
        capabilities: "images",
      },
    ],
    serviceAssignments: [
      {
        serviceName: "image-generation",
        modelIdIndex: 0,
      },
    ],
  },
];

export async function seedDefaultProviders(): Promise<void> {
  for (const seed of DEFAULT_PROVIDERS) {
    // Check if provider already exists by name
    const existing = await db
      .select({ id: aiProvidersTable.id })
      .from(aiProvidersTable)
      .where(eq(aiProvidersTable.name, seed.name));

    let providerId: number;

    if (existing.length > 0) {
      providerId = existing[0]!.id;
      logger.debug({ name: seed.name }, "Provider already seeded — skipping");
    } else {
      const [created] = await db
        .insert(aiProvidersTable)
        .values({
          type: seed.type,
          name: seed.name,
          baseUrl: seed.baseUrl,
          apiKey: seed.apiKey,
          isActive: true,
          sortOrder: 0,
        })
        .returning({ id: aiProvidersTable.id });

      if (!created) throw new Error(`Failed to insert provider: ${seed.name}`);
      providerId = created.id;
      logger.info({ name: seed.name, id: providerId }, "Seeded AI provider");
    }

    // Seed models (idempotent by modelId + providerId)
    const insertedModelIds: number[] = [];

    for (const m of seed.models) {
      const existingModel = await db
        .select({ id: aiProviderModelsTable.id })
        .from(aiProviderModelsTable)
        .where(
          and(
            eq(aiProviderModelsTable.providerId, providerId),
            eq(aiProviderModelsTable.modelId, m.modelId)
          )
        );

      if (existingModel.length > 0) {
        insertedModelIds.push(existingModel[0]!.id);
        logger.debug({ modelId: m.modelId }, "Model already seeded — skipping");
      } else {
        const [createdModel] = await db
          .insert(aiProviderModelsTable)
          .values({
            providerId,
            modelId: m.modelId,
            label: m.label,
            capabilities: m.capabilities,
            isActive: true,
            sortOrder: 0,
          })
          .returning({ id: aiProviderModelsTable.id });

        if (!createdModel) throw new Error(`Failed to insert model: ${m.modelId}`);
        insertedModelIds.push(createdModel.id);
        logger.info({ modelId: m.modelId, id: createdModel.id }, "Seeded AI model");
      }
    }

    // Seed service assignments (only if not already assigned)
    if (seed.serviceAssignments) {
      for (const sa of seed.serviceAssignments) {
        const dbModelId = insertedModelIds[sa.modelIdIndex];
        if (dbModelId == null) continue;

        const existingAssign = await db
          .select({ id: aiServiceAssignmentsTable.id, modelId: aiServiceAssignmentsTable.modelId })
          .from(aiServiceAssignmentsTable)
          .where(eq(aiServiceAssignmentsTable.serviceName, sa.serviceName));

        if (existingAssign.length > 0 && existingAssign[0]!.modelId != null) {
          // Already has an assignment — don't overwrite the admin's choice
          logger.debug({ service: sa.serviceName }, "Service already assigned — skipping");
        } else if (existingAssign.length > 0) {
          // Row exists but modelId is null — fill it
          await db
            .update(aiServiceAssignmentsTable)
            .set({ modelId: dbModelId })
            .where(eq(aiServiceAssignmentsTable.serviceName, sa.serviceName));
          logger.info({ service: sa.serviceName, modelId: dbModelId }, "Updated service assignment");
        } else {
          await db
            .insert(aiServiceAssignmentsTable)
            .values({ serviceName: sa.serviceName, modelId: dbModelId });
          logger.info({ service: sa.serviceName, modelId: dbModelId }, "Seeded service assignment");
        }
      }
    }
  }
}
