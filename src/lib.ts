// Define generic interfaces for entities and queries

export type QueryType<S> = {
    [K in keyof S]: {
        type: K;
        args?: Record<string, unknown>;
        fields: {
            [I in keyof S[K]]?: boolean | QueryType<S>;
        };
    }
}[keyof S]

export type QueryResultType<S> = {
    [K in keyof S]: {
        __type: K;
        fields: {
            [I in keyof S[K]]?: boolean | QueryType<S>;
        };
    }
}[keyof S]

interface Query<S> {
    type: keyof S;
    resolver: (args: any) => Promise<S[keyof S] | null> | S[keyof S] | null;
}

type resolverStoreItem<S, SK> = {
    type: keyof S;
    resolver: (entity: SK, args?:any) => Promise<S[keyof S] | null> | S[keyof S] | null;
}
type resolverStore<SS, SK extends string | number | symbol> = Record<SK, Record<keyof SK, resolverStoreItem<SS, SK>>>;

// Define a generic GraphQL service class
export class GraphQLService<Schemas> {
    private queries: Record<keyof Schemas, Query<Schemas>> = {} as Record<keyof Schemas, Query<Schemas>>;
    private resolvers: resolverStore<Schemas, keyof Schemas> = {} as resolverStore<Schemas, keyof Schemas>;

    // Register a query with its resolver function
    registerQuery(type: keyof Schemas, resolver: (args: any) => Promise<Schemas[typeof type] | null> | Schemas[typeof type] | null) {
        this.queries[type] = { type, resolver };
    }

    // Register a field-level resolver for an entity
    registerResolver(entityName: keyof Schemas, fieldName: keyof [typeof entityName], type: keyof Schemas, resolver: (entity: [typeof entityName], args?:any) => Promise<Schemas[typeof type] | null> | Schemas[typeof type] | null) {
        if (!this.resolvers[entityName]) {
            // @ts-ignore
            this.resolvers[entityName] = {
                [fieldName]: {
                    type,
                    resolver
                }
            };
        }
        // @ts-ignore
        this.resolvers[entityName][fieldName] = {
            type,
            resolver
        };
    }

    // Execute a query by name with provided arguments and selected fields
    async executeQuery<T extends keyof Schemas>(q: QueryType<Schemas>): Promise<Partial<Schemas[T]> | null> {
        const query = this.queries[q.type];
        if (!query) {
            throw new Error(`Query '${String(q.type)}' not found`);
        }
        const result = await query.resolver(q.args)

        if (!result) {
            return null;
        }
        if (!q.fields) {
            const selectedFieldsName = Object.keys(result) as (keyof Schemas[T])[];
            return this.createPartial<T>(q.type as T, result as Schemas[T], selectedFieldsName);
        }

        return this.applyResolversRecursive(result as Schemas[typeof q.type], q) as Promise<Partial<Schemas[T]> | null>;
    }

    private async applyResolversRecursive(result: Schemas[typeof q.type], q: QueryType<Schemas>) {
        const selectedFieldsName = Object.keys(q.fields) as (keyof Schemas[typeof q.type])[];
        for (const fieldName in q.fields) {
            if (!result?.hasOwnProperty(fieldName)) {
                // @ts-ignore
                if (this.resolvers[q.type] && this.resolvers[q.type][fieldName]) {
                    // @ts-ignore
                    const fieldValue = await this.resolvers[q.type][fieldName].resolver(result, q?.args);
                    if (fieldValue) {
                        // @ts-ignore
                        result[fieldName] = fieldValue;
                    }
                }
                if (typeof q.fields[fieldName] === 'object' && typeof result[fieldName] !== 'undefined' && typeof result[fieldName] === 'object') {
                    const subFields = q.fields[fieldName];
                    if (Array.isArray(result[fieldName])) {
                        // @ts-ignore
                        for (let index = 0; index < result[fieldName].length; index++) {
                            // @ts-ignore
                            const subResult = result[fieldName][index];
                            // @ts-ignore
                            result[fieldName][index] = await this.applyResolversRecursive(subResult, subFields as QueryType<Schemas>); // Add type assertion
                        }

                    } else {
                        // @ts-ignore
                        result[fieldName as string] = await this.applyResolversRecursive(result[fieldName as string], subFields as QueryType<Schemas>); // Add type assertion
                    }
                }
            }
        }
        return this.createPartial(q.type, result, selectedFieldsName);
    };

    private createPartial<T extends keyof Schemas>(type: T, result: Schemas[T], selectedFieldsName: (keyof Schemas[T])[]) {
        const r: Schemas[T] & { __type: T } = { ...result, __type: type };
        const selectedResult: Partial<Schemas[T]> = {};
        for (const fieldName of Object.keys(r)) {
            if (fieldName === '__type' || selectedFieldsName.includes(fieldName as keyof Schemas[T])) {
                // @ts-ignore
                selectedResult[fieldName] = r[fieldName];
            }
        }
        return selectedResult;
    }

}