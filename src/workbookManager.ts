// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import JSZip from "jszip";
import { pqUtils, xmlPartsUtils } from "./utils";
import WorkbookTemplate from "./workbookTemplate";
import {
    defaults,
    emptyQueryMashupErr,
    blobFileType,
    application,
    templateWithInitialDataErr,
    tableNotFoundErr,
} from "./utils/constants";
import { DocProps, QueryInfo, TableData, Grid, TableDataParser } from "./types";
import TableDataParserFactory from "./TableDataParserFactory";
import { generateSingleQueryMashup } from "./generators";

export const generateSingleQueryWorkbook = async (
    query: QueryInfo,
    initialDataGrid?: Grid,
    templateFile?: File,
    docProps?: DocProps
): Promise<Blob> => {
    if (!query.queryMashup) {
        throw new Error(emptyQueryMashupErr);
    }

    if (!query.queryName) {
        query.queryName = defaults.queryName;
    }

    if (templateFile !== undefined && initialDataGrid !== undefined) {
        throw new Error(templateWithInitialDataErr);
    }

    pqUtils.validateQueryName(query.queryName);

    const zip: JSZip =
        templateFile === undefined
            ? await JSZip.loadAsync(WorkbookTemplate.SIMPLE_QUERY_WORKBOOK_TEMPLATE, { base64: true })
            : await JSZip.loadAsync(templateFile);

    const tableData: TableData | undefined = await parseInitialDataGrid(initialDataGrid);

    return await generateSingleQueryWorkbookFromZip(zip, query, docProps, tableData);
};

export const generateTableWorkbook = async (initialDataGrid: Grid, docProps?: DocProps): Promise<Blob> => {
    const zip: JSZip = await JSZip.loadAsync(WorkbookTemplate.SIMPLE_BLANK_TABLE_TEMPLATE, { base64: true });
    const tableData: TableData | undefined = await parseInitialDataGrid(initialDataGrid);
    if (tableData === undefined) {
        throw new Error(tableNotFoundErr);
    }

    await xmlPartsUtils.updateWorkbookInitialDataIfNeeded(zip, docProps, tableData);

    return await zip.generateAsync({
        type: blobFileType,
        mimeType: application,
    });
};

const parseInitialDataGrid = async (initialDataGrid?: Grid): Promise<TableData | undefined> => {
    if (!initialDataGrid) {
        return undefined;
    }

    const parser: TableDataParser = TableDataParserFactory.createParser(initialDataGrid);
    const tableData: TableData | undefined = parser.parseToTableData(initialDataGrid);

    return tableData;
};

const generateSingleQueryWorkbookFromZip = async (
    zip: JSZip,
    query: QueryInfo,
    docProps?: DocProps,
    tableData?: TableData
): Promise<Blob> => {
    if (!query.queryName) {
        query.queryName = defaults.queryName;
    }

    await xmlPartsUtils.updatePowerQueryDocument(
        zip,
        query.queryName,
        generateSingleQueryMashup(query.queryName, query.queryMashup)
    );
    await xmlPartsUtils.updateSingleQueryAttributes(zip, query.queryName, query.refreshOnOpen);
    await xmlPartsUtils.updateWorkbookInitialDataIfNeeded(zip, docProps, tableData, true /*updateQueryTable*/);

    return await zip.generateAsync({
        type: blobFileType,
        mimeType: application,
    });
};
