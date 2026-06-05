import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, QueryCommand } from "@aws-sdk/lib-dynamodb";

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));

function toCamelCase(str) {
    if (!str) return '';
    
    // Remove file extension, replace hyphens/underscores with spaces
    const withoutExt = str.replace(/\.[^.]+$/, '');
    const words = withoutExt.split(/[-_\s]+/);
    
    // Capitalize first letter of each word and join
    return words
        .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join(' ');
}

export const handler = async () => {
    const tableName = process.env.DDB_TABLE_NAME;
    const cfDomain = process.env.CLOUDFRONT_DOMAIN;

    const resp = await ddb.send(
        new QueryCommand({
            TableName: tableName,
            IndexName: "GSI1",
            KeyConditionExpression: "gsi1pk = :pk",
            ExpressionAttributeValues: {
                ":pk": "FRAME#ACTIVE",
            },
            ScanIndexForward: false,
        })
    );

    const items = (resp.Items || [])
    .map((it) => ({
        s3Key: it.s3Key,
        name: it.name
        ? toCamelCase(it.name)
        : toCamelCase(it.s3Key.split("/").pop()),
        createdAt: it.createdAt ?? null,
        url: `https://${cfDomain}/${it.s3Key}`,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

    return {
        statusCode: 200,
        headers: {
            "content-type": "application/json",
            "cache-control": "no-store",
        },
        body: JSON.stringify({ frames: items }),
    };
};