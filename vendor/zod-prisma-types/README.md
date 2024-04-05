# Source

- https://github.com/cgyrock/zod-prisma-types

# Fork From

- https://github.com/chrishoermann/zod-prisma-types

# Change

- /packages/generator/src/schemas/generatorConfigSchema.ts

  ```ts
  /**
   * 修改zod-prisma-types的配置描述，增加一个配置项writeDocumentationAsDescribe，
   * 控制是否自动将prisma.schema中定义的模型的字段上 /// 开头的注释自动添加到生成后的zodType的.describe()
   */

  export const configSchema = z.object({
    writeDocumentationAsDescribe: z
      .string()
      .optional()
      .default("false")
      .transform((val) => val === "true"),
  });
  ```

- /packages/generator/src/functions/fieldWriters/writeModelFieldAdditions.ts

  ```ts
  export const writeFieldAdditions = ({
    writer,
    field,
    writeOptionalDefaults = false,
  }: WriteFieldOptions) => {
    const { writeNullishInModelTypes, writeDocumentationAsDescribe } =
      field.generatorConfig;

    writer

      // ......

      /**
       * 所有属性最好判断一下，writeDocumentationAsDescribe = true 且字段上有/// 开头的注释
       * 则添加.describe("${field.clearedDocumentation}")
       */

      .conditionalWrite(
        writeDocumentationAsDescribe &&
          field.clearedDocumentation !== undefined,
        `.describe("${field.clearedDocumentation}")`,
      )

      // ......

      .write(`,`)
      .newLine();
  };
  ```

# Usage

```

git clone https://github.com/cgyrock/zod-prisma-types.git
cd ./zod-prisma-types/packages/generator/
yarn pack

// 拷贝生成的zod-prisma-types-v3.1.6.tgz到当前目录
// yarn add -D file:./vendor/zod-prisma-types/zod-prisma-types-v3.1.6.tgz

```
