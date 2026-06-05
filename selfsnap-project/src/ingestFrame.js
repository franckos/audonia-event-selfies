import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb";

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));

function decodeS3Key(key) {
    return decodeURIComponent(key.replace(/\+/g, " "));
}

export const handler = async (event) => {
    const tableName = process.env.DDB_TABLE_NAME;

    for (const rec of event.Records || []) {
        const rawKey = rec.s3.object.key;
        const s3Key = decodeS3Key(rawKey);

        // Only objects under frames/
        if (!s3Key.startsWith("frames/")) continue;

        const file = s3Key.split("/").pop() || "frame";
        const name = file.replace(/\.[^.]+$/, "").replace(/[-_]/g, " ");

        const createdAt = rec.eventTime || new Date().toISOString();

        const item = {
            s3Key,
            name,
            isActive: true,
            createdAt,
            gsi1pk: "FRAME#ACTIVE",
            gsi1sk: `${createdAt}#${s3Key}`,
        };

        await ddb.send(
            new PutCommand({
            TableName: tableName,
            Item: item,
            })
        );
    }

    return { statusCode: 200 };
};