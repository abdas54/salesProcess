sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel",
    "sap/m/MessageToast",
    "sap/ui/core/Fragment",
    "sap/m/MessageBox",
    "com/eros/salesprocess/model/formatter",
    "sap/m/BusyDialog",
    "sap/m/PlacementType",
    "sap/ndc/BarcodeScanner"
],
    /**
     * @param {typeof sap.ui.core.mvc.Controller} Controller
     */
    function (Controller, JSONModel, MessageToast, Fragment, MessageBox, formatter, BusyDialog, PlacementType, BarcodeScanner) {
        "use strict";
        var that;
        return Controller.extend("com.eros.salesprocess.controller.MainView", {
            formatter: formatter,
            onInit: function () {
                that = this;
                $("body").css("zoom", "90%");


                this.token = 0;
                this.oModel = this.getOwnerComponent().getModel();
                this.oModel.setSizeLimit(1000);
                this.customerModel = this.getOwnerComponent().getModel("customerService");
                this.getView().setModel(this.customerModel, "CustomerModel");

                this.productModel = new JSONModel({ Product: [], MaterialCode: "" });
                this.getView().setModel(this.productModel, "ProductModel");

                this.backupProdArr = [];

                that.stockModel = new JSONModel({ Product: [], inpMatCode: "" });
                that.getView().setModel(that.stockModel, "StockModel");

                that.homeDelModel = new JSONModel({ Product: [] });
                that.getView().setModel(that.homeDelModel, "HomeDelModel");

                that.customerAddressModel = new JSONModel();
                this.getView().setModel(this.customerAddressModel, "custAddModel");

                this.getView().byId("page").setVisible(false);

                var showSection = new JSONModel();
                showSection.setData({
                    "selectedMode": ""
                });
                this.getView().setModel(showSection, "ShowSection");

                var model1 = new JSONModel();
                model1.setData({
                    "selectedMode": ""
                });
                this.getView().setModel(model1, "ShowCardsSection");

                var model2 = new JSONModel();
                model2.setData({
                    "selectedMode": ""
                });
                this.getView().setModel(model2, "ShowCurrencySection");

                var model3 = new JSONModel();
                model3.setData({
                    "selectedMode": "",
                    "cardPaymentMode": 0
                });
                this.getView().setModel(model3, "ShowPaymentSection");

                var model4 = new JSONModel();
                model4.setData({
                    "selectedMode": "Item List",

                });
                this.getView().setModel(model4, "ShowDiscountSection");

                //this._openSalesmanDialog();
                this.validateLoggedInUser();
                this.aEntries = [];
                this.aEntries1 = [];
                this.aPaymentEntries = [];
                this.serialNumbers = [];
                this.masterSerialNumber = [];
                this.paymentId = 0;
                this.sourceIdCounter = 0;
                this.paymentEntSourceCounter = 0;
                this.shippingMethod = "";
                this.suspendComments = "";
                this.openStockTile = false;


            },

            validateLoggedInUser: function () {
                var that = this;
                this.oModel.read("/StoreIDSet", {
                    success: function (oData) {
                        that.storeID = oData.results[0] ? oData.results[0].Store : "";
                        that.plantID = oData.results[0] ? oData.results[0].Plant : "";
                        that.onPressPayments();
                    },
                    error: function (oError) {
                        sap.m.MessageBox.show(JSON.parse(oError.responseText).error.message.value, {
                            icon: sap.m.MessageBox.Icon.Error,
                            title: "Error",
                            actions: [MessageBox.Action.OK],
                            onClose: function (oAction) {
                                if (oAction === MessageBox.Action.OK) {
                                    window.history.go(-1);
                                }
                            }
                        });
                    }
                });
            },
            getManualMatDetail: function (oEvent) {
                this.getMaterialDetail(true, oEvent.getParameter("value"));
            },
            getMaterialDetail: function (flag, matCode) {
                var aFilters = [];

                aFilters.push(new sap.ui.model.Filter("Itemcode", sap.ui.model.FilterOperator.EQ, matCode));

                this.oModel.read("/MaterialSet", {
                    urlParameters: {
                        "$expand": "ToDiscounts"
                    },
                    filters: aFilters,
                    success: function (oData) {
                        if (oData.results.length > 0) {
                            oData.results[0].SaleQuantity = 1;
                            oData.results[0].HomeDelivery = false;
                            oData.results[0].NetAmount = oData.results[0].GrossPrice;
                            oData.results[0].Seq = "";
                            oData.results[0].SalesmanId = "";
                            oData.results[0].SalesmanName = "";
                            that.reservedItemOwnLocation(oData.results);


                        }

                    },
                    error: function (oError) {
                        aFilters.push(new sap.ui.model.Filter("AllLocations", sap.ui.model.FilterOperator.EQ, "X"));
                        if (JSON.parse(oError.responseText).error.message.code === "MATERIAL_CHECK") {
                            sap.m.MessageBox.show(
                                "Item is not available at this store location. Do you want to check other locations?", {
                                icon: sap.m.MessageBox.Icon.INFORMATION,
                                title: "Availability Check",
                                actions: ["OK", "CANCEL"],
                                onClose: function (oAction) {
                                    if (oAction === "OK") {
                                        that.getMaterialAllLocation(aFilters);
                                    } else {

                                    }
                                }
                            }
                            );
                        }
                        else {
                            sap.m.MessageBox.show(
                                JSON.parse(oError.responseText).error.message.value, {
                                icon: sap.m.MessageBox.Icon.Error,
                                title: "Error",
                                actions: ["OK", "CANCEL"],
                                onClose: function (oAction) {

                                }
                            }
                            );
                        }

                    }
                });
            },
            getMaterialAllLocation: function (aFilters) {
                this.oModel.read("/MaterialSet", {
                    urlParameters: {
                        "$expand": "ToDiscounts"
                    },
                    filters: aFilters,
                    success: function (oData) {
                        if (oData.results.length > 0) {
                            for (var count = 0; count < oData.results.length; count++) {
                                oData.results[count].SaleQuantity = 1;
                                oData.results[count].HomeDelivery = true;
                                oData.results[count].NetAmount = oData.results[count].GrossPrice;
                                oData.results[count].Seq = "";
                                oData.results[count].SalesmanId = "";
                                oData.results[count].SalesmanName = "";
                            }

                            that.stockGlobalModel = new JSONModel({ Product: [] });
                            that.getView().setModel(that.stockGlobalModel, "StockGlobalModel");
                            var aProducts = that.getView().getModel("StockGlobalModel").getProperty("/Product");
                            aProducts.push(...oData.results);
                            that.getView().getModel("StockGlobalModel").setProperty("/Product", aProducts);
                            that.getView().getModel("StockGlobalModel").setProperty("/MaterialCode", "");
                            if (!that.openStockTile) {
                                if (!that._oDialogGlobalStock) {
                                    Fragment.load({
                                        name: "com.eros.salesprocess.fragment.stockAllLocationAvailability",
                                        controller: that
                                    }).then(function (oFragment) {
                                        that._oDialogGlobalStock = oFragment;
                                        that.getView().addDependent(that._oDialogGlobalStock);
                                        that._oDialogGlobalStock.open();
                                    }.bind(that));
                                } else {
                                    that._oDialogGlobalStock.open();
                                }
                            }

                        }

                    },
                    error: function (oError) {

                        sap.m.MessageBox.show(
                            JSON.parse(oError.responseText).error.message.value, {
                            icon: sap.m.MessageBox.Icon.Error,
                            title: "Error",
                            actions: ["OK", "CANCEL"],
                            onClose: function (oAction) {

                            }
                        }
                        );


                    }
                });
            },
            onDelete: function (oEvent) {
                var oTable = this.getView().byId("idProductsTable");
                var oModel = this.getView().getModel("ProductModel"); // Get the JSON model
                var aProducts = oModel.getProperty("/Product"); // Get the array from the model

                // Get the selected item from the event
                var oItem = oEvent.getParameter("listItem");
                var oContext = oItem.getBindingContext("ProductModel");
                this.deleteItemReservation(oModel.getObject(oContext.sPath), oContext);
                // if (oContext) {
                //     var iIndex = oContext.getPath().split("/").pop(); // Extract index
                //     aProducts.splice(iIndex, 1); // Remove the item from array
                //     oModel.setProperty("/Product", aProducts); // Update the model
                //     oModel.refresh(); // Refresh UI binding
                // }
            },
            deleteItemReservation: function (data, oContext) {
                var oModel = this.getView().getModel("ProductModel"); // Get the JSON model
                var aProducts = oModel.getProperty("/Product");
                var that = this;
                var oPayload = {
                    "TransactionId": this.getView().byId("tranNumber").getCount(),
                    "ReservedFlag": "D",
                    "Material": data.Itemcode,
                    "Plant": data.Plant,
                    "Location": data.Location,
                    "Quantity": data.SaleQuantity.toString(),
                    "ReservationNo": "",
                    "Type": "",
                    "Status": ""

                }

                this.oModel.create("/ReservationSet", oPayload, {
                    success: function (oData) {
                        if (oContext) {
                            that.serialNumbers = that.serialNumbers.filter(function(entry) {
                                return entry.itemCode !== data.Itemcode;
                            });

                            var iIndex = oContext.getPath().split("/").pop(); // Extract index
                            var delItemCode = that.getView().getModel("ProductModel").getProperty("/Product/" + iIndex).Itemcode;
                            aProducts.splice(iIndex, 1); // Remove the item from array
                            that.updateSeq(aProducts);
                            if (that.getView().getModel("ProductModel").getProperty("/Product").length > 0) {
                                that.checkEnableDisableTile(true);
                            }
                            else {
                                that.checkEnableDisableTile(false);
                            }
                            that.updateDiscountTable(delItemCode);
                            //oModel.setProperty("/Product", aProducts); // Update the model
                            oModel.refresh(); // Refresh UI binding
                        }
                    },
                    error: function (oError) {
                        sap.m.MessageToast.show("Error in Deleting the item");
                    }
                });


            },
            updateDiscountTable: function (itemCode) {
                var oModel = this.getView().getModel("discountModelTable");
                var oData = oModel.getData(); // returns { entries: [...] }
                var aEntries = oData.entries;

                // Define the ItemCode to remove
                var sItemCodeToRemove = itemCode; // Replace with dynamic value as needed

                // Filter out the entry with matching ItemCode
                var aFiltered = aEntries.filter(function (entry) {
                    return entry.ItemCode !== sItemCodeToRemove;
                });

                // Update the model
                oModel.setProperty("/entries", aFiltered);
                this.aEntries1 = that.aEntries1.filter(function (entry) {
                    return entry.ItemCode !== itemCode;
                });
            },
            onPressCurrency: function () {
                var model = new JSONModel();
                model.setData({
                    "selectedMode": "CurrencyView"
                });
                this.getView().setModel(model, "ShowCurrencySection");
            },
            _openSalesmanDialog: function () {
                if (!this._oDialog) {
                    Fragment.load({
                        id: this.getView().getId(),
                        name: "com.eroserospos.Fragment.SalesmanDialog",
                        controller: this
                    }).then(function (oDialog) {
                        this._oDialog = oDialog;
                        this.getView().addDependent(this._oDialog);
                        this._oDialog.open();
                    }.bind(this));
                } else {
                    this._oDialog.open();
                }
            },
            onDialogClose: function () {
                this.getView().byId("page").setVisible(true);
            },
            onDialogConfirm: function () {
                var sInputValue = this.byId("salesmanInput").getValue();
                if (sInputValue.trim()) {
                    MessageToast.show("Salesman ID/Name entered: " + sInputValue);
                    this._oDialog.close();
                    this.getView().byId("page").setVisible(true);
                } else {
                    MessageToast.show("Please enter Salesman ID/Name!");
                }
            },

            onInputChange: function (oEvent) {
                // Optional: Perform live validation if needed
                var sValue = oEvent.getParameter("value");
                console.log("Current Input: ", sValue);
            },

            onHoldBill: function () {
                MessageToast.show("Bill is on hold!");
            },

            onVoidAll: function () {
                MessageToast.show("All items voided!");
            },

            onVoidLine: function () {
                MessageToast.show("Selected line voided!");
            },

            onPriceCheck: function () {
                MessageToast.show("Price checked!");
            },
            getStockDetail: function (flag, matCode) {
                var aFilters = [];


                aFilters.push(new sap.ui.model.Filter("Itemcode", sap.ui.model.FilterOperator.EQ, matCode));

                aFilters.push(new sap.ui.model.Filter("AllLocations", sap.ui.model.FilterOperator.EQ, "X"));
                this.oModel.read("/MaterialSet", {
                    urlParameters: {
                        "$expand": "ToDiscounts"
                    },
                    filters: aFilters,
                    success: function (oData) {
                        if (oData.results.length > 0) {
                            that.stockModel = new JSONModel({ Product: [] });
                            that.getView().setModel(that.stockModel, "StockModel");
                            var aProducts = that.getView().getModel("StockModel").getProperty("/Product");
                            aProducts.push(...oData.results);
                            that.getView().getModel("StockModel").setProperty("/Product", aProducts);
                            //that.onOpenFragment();

                        }
                        else {
                            sap.m.MessageBox.show(
                                "No Item found", {
                                icon: sap.m.MessageBox.Icon.INFORMATION,
                                title: "Stock Availability Check",
                                actions: ["OK", "CANCEL"],
                                onClose: function (oAction) {
                                    if (oAction === "OK") {

                                    } else {

                                    }
                                }
                            }
                            );
                        }
                        console.log("Success", oData);
                    },
                    error: function (oError) {
                        console.error("Error", oError);
                    }
                });
            },
            // onScanSuccessStock: function (oEvent) {
            //     if (oEvent.getParameter("cancelled")) {
            //         MessageToast.show("Scan cancelled", { duration: 1000 });
            //     } else {
            //         if (oEvent.getParameter("text")) {
            //             this.getStockDetail(false, oEvent.getParameter("text"));

            //         }
            //     }
            // },
            // onScanErrorOne: function (oEvent) {
            //     MessageToast.show("Scan Failed");
            // },
            getStockDetailManually: function (oEvent) {
                this.getStockDetail(true, oEvent.getParameter("value"));
            },
            // onScanSuccessOne: function (oEvent) {
            //     if (oEvent.getParameter("cancelled")) {
            //         MessageToast.show("Scan cancelled", { duration: 1000 });
            //     } else {
            //         if (oEvent.getParameter("text")) {
            //             this.getMaterialDetail(false, oEvent.getParameter("text"));

            //         }
            //     }
            // },

            onStockAvailability: function () {
                this.openStockTile = true;
                that.stockModel = new JSONModel({ Product: [], inpMatCode: "" });
                that.getView().setModel(that.stockModel, "StockModel");
                this.onOpenFragment();
            },
            onOpenFragment: function () {
                if (!this._oDialogStock) {
                    Fragment.load({
                        name: "com.eros.salesprocess.fragment.stockAvailability",
                        controller: this
                    }).then(function (oFragment) {
                        this._oDialogStock = oFragment;
                        this.getView().addDependent(this._oDialogStock);
                        this._oDialogStock.open();
                    }.bind(this));
                } else {
                    this._oDialogStock.open();
                }

            },
            onPressOkButton: function () {
                this.openStockTile = false;
                this._oDialogStock.close();
            },
            onCustomerLink: function () {
                var customerData = {
                    FirstName: "John",
                    LastName: "Doe",
                    PhoneNumber: "1234567890",
                    DateOfBirth: "1990-01-01",
                    HomeAddress: "123 Main St, Hometown",
                    DeliveryAddress: "456 Delivery Ln, City"
                };
                var oCustomerModel = new JSONModel(customerData);
                this.getView().setModel(oCustomerModel, "CustomerModel");
                if (!this._oDialogCustomer) {
                    Fragment.load({
                        name: "com.eroserospos.Fragment.customerData",
                        controller: this
                    }).then(function (oFragment) {
                        this._oDialogCustomer = oFragment;
                        this.getView().addDependent(this._oDialogCustomer);
                        this._oDialogCustomer.open();
                    }.bind(this));
                } else {
                    this._oDialogCustomer.open();
                }
            },
            onPressCustomerButton: function () {
                this._oDialogCustomer.close();
            },
            onPressDiscount: function () {
                var selectedItem = this.getView().byId("idProductsTable").getSelectedItem();
                if (!selectedItem) {
                    var oModel = new sap.ui.model.json.JSONModel({
                        "ItemCode": "",
                        "ConditionType": "",
                        "Reason": "",
                        "Amount": "",
                        "Authority": "",

                    });
                    this.getView().setModel(oModel, "discountModel");
                    if (!this._oDialogDiscount) {
                        Fragment.load({
                            name: "com.eros.salesprocess.fragment.discount",
                            controller: this
                        }).then(function (oFragment) {
                            this._oDialogDiscount = oFragment;
                            this.getView().addDependent(this._oDialogDiscount);
                            this._oDialogDiscount.open();
                        }.bind(this));
                    } else {
                        this._oDialogDiscount.open();
                    }
                }
                else {
                    MessageToast.show("Select Item to apply for Manual Discount");
                }


            },
            onCloseManualDiscount: function () {
                this._oDialogDiscount.close();
            },
            onSelectItemCode: function (oEvent) {
                this.sItemDescription = oEvent.getParameter("selectedItem").getProperty("text");
                // var oComboBox = oEvent.getParameter("value");
                // var oProductModel = this.getView().getModel("ProductModel");
                // var aProducts = oProductModel.getProperty("/Product");
                // var oMatchedItem = aProducts.find(obj => obj.Itemcode === oComboBox);
                // var description = ""

                // if (oMatchedItem) {
                //     description= oMatchedItem.Description;
                //     } else {
                //         description = ""; // or return null, or "Unknown"
                // }
                this.getView().getModel("discountModel").setProperty("/ItemDescription", this.sItemDescription);
            },
            onAddManualDiscount: function () {
                var oView = this.getView();
                var oModel = oView.getModel("discountModel");
                var sItemCode = oModel.getProperty("/ItemCode");
                var sReason = oModel.getProperty("/Reason");
                var sType = oModel.getProperty("/ConditionType");
                var sAmount = oModel.getProperty("/Amount");
                var sAuthority = oModel.getProperty("/Authority");


                var duplicate = false;

                if (!sReason || !sType || !sAmount || !sAuthority || !sItemCode) {
                    MessageToast.show("Please fill all fields.");
                    return;
                }

                if (this.aEntries.length > 0) {

                    for (var count = 0; count < this.aEntries.length; count++) {
                        if (this.aEntries[count].ItemCode === sItemCode && this.aEntries[count].Type === sType) {
                            duplicate = true;
                            break;
                        }
                    }
                }

                if (!duplicate) {
                    this.aEntries.push({
                        ItemCode: sItemCode,
                        ItemDescription: this.sItemDescription,
                        Reason: sReason,
                        Type: sType,
                        Amount: sAmount,
                        Authority: sAuthority,
                        ConditionName: this.sConditionName,
                        DiscountType: "M"

                    });

                    var oModel1 = new sap.ui.model.json.JSONModel();
                    oModel1.setData({ "entries": this.aEntries });
                    this.getView().setModel(oModel1, "discountModelTbl");

                    oModel.setProperty("/ItemCode", "");
                    oModel.setProperty("/Reason", "");
                    oModel.setProperty("/ConditionType", "");
                    oModel.setProperty("/Amount", "");
                    oModel.setProperty("/Authority", "");
                    oModel.setProperty("/ItemDescription", "");
                    oModel.refresh();
                }
                else {
                    MessageBox.error("Same Discount has been already applied. Kindly Delete the existing record to add new Discount");
                }

            },
            onSelectConditionType: function (oEvent) {
                this.sConditionName = oEvent.getParameter("selectedItem").getProperty("text");
            },
            onDeleteManualPayment: function(oEvent){
                var oModel = this.getView().getModel("ShowPaymentSection"); // Get the JSON model
                var aEntries = oModel.getProperty("/allEntries"); // Get the array from the model
                var oItem = oEvent.getParameter("listItem");
                var oContext = oItem.getBindingContext("ShowPaymentSection");
                var dataObj = oModel.getObject(oContext.sPath);
                var iIndex = oContext.getPath().split("/").pop();
                aEntries.splice(iIndex, 1);
                //this.aPaymentEntries.splice(iIndex,1);
                var balanceAmount = "";
                var totSalBal = sap.ui.getCore().byId("totalSaleBalText").getText();
                balanceAmount = parseFloat(dataObj.Amount) + parseFloat(totSalBal)
                sap.ui.getCore().byId("totalSaleBalText").setText(parseFloat(balanceAmount).toFixed(2));
                this.getView().getModel("ShowPaymentSection").setProperty("/allEntries",this.aPaymentEntries)
                this.getView().getModel("ShowPaymentSection").refresh();

            },
            onDeleteManualDiscount: function (oEvent) {
                var bflag = false;
                var oModel = this.getView().getModel("discountModelTbl"); // Get the JSON model
                var aEntries = oModel.getProperty("/entries"); // Get the array from the model
                var oItem = oEvent.getParameter("listItem");
                var oContext = oItem.getBindingContext("discountModelTbl");
                var dataObj = oModel.getObject(oContext.sPath);
                var iIndex = oContext.getPath().split("/").pop(); // Extract index
                var matchProdTableIndex = -1;
                var matchDiscTableIndex = -1;
                aEntries.splice(iIndex, 1);
                oModel.refresh();
                var productTblData = this.getView().getModel("ProductModel").getProperty("/Product");
                for (var count = 0; count < productTblData.length; count++) {
                    var discountData = productTblData[count].ToDiscounts.results;
                    for (var count2 = 0; count2 < discountData.length; count2++) {

                        if (dataObj.ItemCode === discountData[count2].ItemCode && dataObj.ConditionName === discountData[count2].ConditionName && dataObj.DiscountType === "M") {
                            bflag = true;
                            matchProdTableIndex = count;
                            matchDiscTableIndex = count2;
                            break;
                        }
                    }
                }
                if (bflag) {
                    this.removeManualDiscount(matchProdTableIndex, productTblData[matchProdTableIndex], dataObj);
                    this.getView().getModel("ProductModel").getProperty("/Product")[matchProdTableIndex].ToDiscounts.results.splice(matchDiscTableIndex, 1);
                }
            },
            onPressDiscountButton: function () {
                this._oDialogDiscount.close();

            },
            onApplyManualDiscount: function () {
                var discountTblData = this.getView().getModel("discountModelTbl").getProperty("/entries");
                var productTblData = this.getView().getModel("ProductModel").getProperty("/Product");

                for (var count = 0; count < productTblData.length; count++) {

                    for (var count1 = 0; count1 < discountTblData.length; count1++) {
                        if (discountTblData[count1].ItemCode === productTblData[count].Itemcode) {
                            var bflag = false;
                            for (var count2 = 0; count2 < productTblData[count].ToDiscounts.results.length; count2++) {
                                var dataObj = productTblData[count].ToDiscounts.results;
                                if (dataObj[count2].ItemCode === discountTblData[count1].ItemCode && dataObj[count2].ConditionName === discountTblData[count1].ConditionName) {
                                    bflag = true;
                                    break;
                                }

                            }
                            if (!bflag) {
                                productTblData[count].ToDiscounts.results.push({
                                    "ConditionAmount": "-" + discountTblData[count1].Amount,
                                    "ConditionId": this.retrieveConditionId(productTblData[count]),
                                    "ConditionName": discountTblData[count1].ConditionName,
                                    "ConditionType": discountTblData[count1].Type,
                                    "Currency": "AED",
                                    "DiscountType": "M",
                                    "ItemCode": discountTblData[count1].ItemCode,
                                    "ModifierType": "D",
                                    "Remarks": discountTblData[count1].Reason,
                                    "Authority": discountTblData[count1].Authority

                                })
                                this.updateProductTable(count, productTblData[count], discountTblData[count1]);
                            }
                        }
                    }
                }
                this._oDialogDiscount.close();

            },
            retrieveConditionId: function (productTableData) {
                var itemDiscountCondition = productTableData.ToDiscounts.results;
                var incConditionId = "";
                var conditionId = "";
                if (itemDiscountCondition.length > 0) {
                    conditionId = itemDiscountCondition[itemDiscountCondition.length - 1].ConditionId;
                    incConditionId = parseInt(conditionId) + 1;
                    return incConditionId.toString();
                }
                else {
                    incConditionId = 1;
                    return incConditionId.toString();
                }



            },
            updateProductTable: function (count, productTblData, discountTblData) {
                var selIndex = count;
                var updatedNetAmount = "";
                var updateDiscount = parseFloat(parseFloat(productTblData.Discount).toFixed(2) - parseFloat(discountTblData.Amount).toFixed(2)).toFixed(2);
                this.getView().getModel("ProductModel").getObject("/Product/" + selIndex).Discount = updateDiscount;
                if (parseInt(productTblData.SaleQuantity) === 1) {
                    updatedNetAmount = parseFloat(parseFloat(productTblData.UnitPrice) + parseFloat(updateDiscount)).toFixed(2);
                    //this.getView().getModel("ProductModel").getObject("/Product/" + selIndex).NetAmount = parseFloat(updatedNetAmount).toFixed(2);
                    var vatAmount = parseFloat(parseInt(updatedNetAmount) * (parseInt(parseFloat(productTblData.VatPercent).toFixed(2)) / 100)).toFixed(2);
                    this.getView().getModel("ProductModel").getObject("/Product/" + selIndex).VatAmount = vatAmount;
                    this.getView().getModel("ProductModel").getObject("/Product/" + selIndex).SaleAmount = parseFloat(parseFloat(vatAmount) + parseFloat(updatedNetAmount)).toFixed(2);
                    this.getView().getModel("ProductModel").getObject("/Product/" + selIndex).NetDiscount = parseFloat(parseFloat(updateDiscount).toFixed(2) * parseFloat(productTblData.SaleQuantity).toFixed(2)).toFixed(2);

                }
                else {
                    updatedNetAmount = parseFloat(productTblData.UnitPrice).toFixed(2);
                    this.getView().getModel("ProductModel").getObject("/Product/" + selIndex).NetAmount = parseFloat(parseFloat(updatedNetAmount).toFixed(2) * parseFloat(productTblData.SaleQuantity).toFixed(2)).toFixed(2);
                    this.getView().getModel("ProductModel").getObject("/Product/" + selIndex).NetDiscount = parseFloat(parseFloat(updateDiscount).toFixed(2) * parseFloat(productTblData.SaleQuantity).toFixed(2)).toFixed(2);
                    var netAmount = this.getView().getModel("ProductModel").getObject("/Product/" + selIndex).NetAmount;
                    var netDiscount = this.getView().getModel("ProductModel").getObject("/Product/" + selIndex).NetDiscount
                    var vatPercent = this.getView().getModel("ProductModel").getObject("/Product/" + selIndex).VatPercent

                    //this.getView().getModel("ProductModel").getObject("/Product/" + selIndex).NetAmount= parseFloat(parseFloat(netAmount) + parseFloat(netDiscount)).toFixed(2);
                    this.calculateVATAmount(netAmount, netDiscount, vatPercent, selIndex);
                    this.calculateSalesAmount(netAmount, netDiscount, vatPercent, selIndex);
                }

                this.getView().getModel("ProductModel").refresh();
                this.setHeaderData();


            },
            removeManualDiscount: function (count, productTblData, discountTblData) {
                var selIndex = count;
                var updatedNetAmount = "";
                var updateDiscount = parseFloat(parseFloat(productTblData.Discount) + parseFloat(discountTblData.Amount)).toFixed(2);
                this.getView().getModel("ProductModel").getObject("/Product/" + selIndex).Discount = updateDiscount;

                if (parseInt(productTblData.SaleQuantity) === 1) {
                    updatedNetAmount = parseFloat(parseFloat(productTblData.UnitPrice) + parseFloat(updateDiscount)).toFixed(2);
                    // this.getView().getModel("ProductModel").getObject("/Product/" + selIndex).NetAmount = parseFloat(updatedNetAmount).toFixed(2);
                    var vatAmount = parseFloat(parseInt(updatedNetAmount) * (parseInt(parseFloat(productTblData.VatPercent).toFixed(2)) / 100)).toFixed(2);
                    this.getView().getModel("ProductModel").getObject("/Product/" + selIndex).VatAmount = vatAmount;
                    this.getView().getModel("ProductModel").getObject("/Product/" + selIndex).SaleAmount = parseFloat(parseFloat(vatAmount) + parseFloat(updatedNetAmount)).toFixed(2);
                    this.getView().getModel("ProductModel").getObject("/Product/" + selIndex).NetDiscount = parseFloat(parseFloat(updateDiscount).toFixed(2) * parseFloat(productTblData.SaleQuantity).toFixed(2)).toFixed(2);

                }
                else {
                    updatedNetAmount = parseFloat(productTblData.UnitPrice).toFixed(2);
                    this.getView().getModel("ProductModel").getObject("/Product/" + selIndex).NetAmount = parseFloat(parseFloat(updatedNetAmount).toFixed(2) * parseFloat(productTblData.SaleQuantity).toFixed(2)).toFixed(2);
                    this.getView().getModel("ProductModel").getObject("/Product/" + selIndex).NetDiscount = parseFloat(parseFloat(updateDiscount).toFixed(2) * parseFloat(productTblData.SaleQuantity).toFixed(2)).toFixed(2);
                    var netAmount = this.getView().getModel("ProductModel").getObject("/Product/" + selIndex).NetAmount;
                    var netDiscount = this.getView().getModel("ProductModel").getObject("/Product/" + selIndex).NetDiscount
                    var vatPercent = this.getView().getModel("ProductModel").getObject("/Product/" + selIndex).VatPercent
                    //this.getView().getModel("ProductModel").getObject("/Product/" + selIndex).NetAmount= parseFloat(parseFloat(netAmount) + parseFloat(netDiscount)).toFixed(2);
                    this.calculateVATAmount(netAmount, netDiscount, vatPercent, selIndex);
                    this.calculateSalesAmount(netAmount, netDiscount, vatPercent, selIndex);
                }
                this.getView().getModel("ProductModel").refresh();
                this.setHeaderData();
            },

            onDiscountTypeSelect: function (oEvent) {
                var oSelectedButton = oEvent.getParameter("selectedIndex");
                // var sKey = oSelectedButton.data("key");
                var oItemLevelVBox = sap.ui.getCore().byId("itemLevelDiscountVBox");

                if (oSelectedButton === 1) {
                    oItemLevelVBox.setVisible(true);
                } else {
                    oItemLevelVBox.setVisible(false);
                }
            },
            onPressPayments: function () {
                if (!this._oDialogCashier) {
                    Fragment.load({
                        name: "com.eros.salesprocess.fragment.cashier",
                        controller: this
                    }).then(function (oFragment) {
                        this._oDialogCashier = oFragment;
                        this.getView().addDependent(this._oDialogCashier);
                        this._oDialogCashier.open();
                    }.bind(this));
                } else {
                    this._oDialogCashier.open();
                }
            },
            fnCloseCashier: function () {
                this._oDialogCashier.close();
            },
            fnValidateCashier: function (oEvent) {
                var that = this;
                that.getView().byId("page").setVisible(false);
                var empId = oEvent.getSource().getParent().getContent()[0].getItems()[0].getContent()[1].getValue();
                var pwd = oEvent.getSource().getParent().getContent()[0].getItems()[0].getContent()[3].getValue();
                var aFilters = [];

                aFilters.push(new sap.ui.model.Filter("Etype", sap.ui.model.FilterOperator.EQ, "C"));
                aFilters.push(new sap.ui.model.Filter("EmployeeId", sap.ui.model.FilterOperator.EQ, empId));
                aFilters.push(new sap.ui.model.Filter("SecretCode", sap.ui.model.FilterOperator.EQ, pwd));
                aFilters.push(new sap.ui.model.Filter("Generate", sap.ui.model.FilterOperator.EQ, "Y"));

                //EmployeeSet?$filter=Etype eq 'C' and EmployeeId eq '112' and SecretCode eq 'Abc#91234'

                this.oModel.read("/EmployeeSet", {
                    filters: aFilters,
                    success: function (oData) {
                        that.cashierID = oData.results[0] ? oData.results[0].EmployeeId : "";
                        that.cashierName = oData.results[0] ? oData.results[0].EmployeeName : "";
                        that._oDialogCashier.close();
                        that.getView().byId("cashier").setCount(oData.results[0].EmployeeName);
                        that.getView().byId("tranNumber").setCount(oData.results[0].TransactionId);
                        that.getView().byId("page").setVisible(true);

                    },
                    error: function (oError) {
                        that.getView().byId("page").setVisible(false);
                        if (JSON.parse(oError.responseText).error.code === "CASHIER_CHECK") {
                            sap.m.MessageBox.show(
                                JSON.parse(oError.responseText).error.message.value, {
                                icon: sap.m.MessageBox.Icon.Error,
                                title: "Cashier Validation",
                                actions: ["OK", "CANCEL"],
                                onClose: function (oAction) {

                                }
                            }
                            );
                        }
                        else {
                            sap.m.MessageBox.show(
                                JSON.parse(oError.responseText).error.message.value, {
                                icon: sap.m.MessageBox.Icon.Error,
                                title: "Error",
                                actions: ["OK", "CANCEL"],
                                onClose: function (oAction) {

                                }
                            }
                            );
                        }
                        console.error("Error", oError);
                    }
                });

            },
            validCustomer: function () {
                var entered = this.getView().byId("customer").getCount();
                if (entered) {
                    return true;
                }
                else {
                    return false
                }

            },
            validSerial: function () {
                var oProductModel = this.getView().getModel("ProductModel");
                var aProductData = oProductModel.getProperty("/Product");

                // Initialize an empty array
                var aItemCodesWithSerialFlagY = [];

                // Loop through the data
                if (aProductData && Array.isArray(aProductData)) {
                    aProductData.forEach(function (oItem) {
                        if (oItem.SerialFlag === "Y") {
                            aItemCodesWithSerialFlagY.push(oItem.Itemcode);
                        }
                    });
                }

                var bAllSerialsExist = aItemCodesWithSerialFlagY.every(function (sItemCode) {
                    return this.serialNumbers.some(function (oSerial) {
                        return oSerial.itemCode === sItemCode && oSerial.serialNumber && oSerial.serialNumber.trim() !== "";
                    });
                }.bind(this));

                return bAllSerialsExist;

            },
            onCheckSaleAmounts: function () {
                var that = this;
                var oModel = this.getView().getModel("ProductModel");
                var aProducts = oModel.getProperty("/Product");
                this.aNegativeItems = [];

                aProducts.forEach(function (oItem) {
                    if (oItem.SaleAmount < 0) {
                        that.aNegativeItems.push(oItem.Itemcode);
                    }
                });

                if (this.aNegativeItems.length > 0) {

                    return false;
                } else {
                    return true;
                }
            },

            onPressPayments1: function () {
                var that = this;
                var checkCustomer = this.validCustomer();
                var checkSerial = this.validSerial();
                var discountAmount = this.onCheckSaleAmounts();
                var checkHomeDelivery = this.checkHomeDelivery();
                var chckSalesman = this.checkSalesman();
                var custData = this.getView().getModel("custAddModel").getData();
                var homeDelivery = true;
                var paidAmount = 0;
                var balanceAmount="";
                var saleAmount="";
                if(checkHomeDelivery === "HD"){
                    if (custData.shippingDate === undefined || custData.shippingDate === null || custData.ShippingInst === undefined || custData.ShippingInst === null){
                        homeDelivery = false;
                    }
                }
                if (checkCustomer && checkSerial && discountAmount && homeDelivery && chckSalesman) {
                    var oModel = new sap.ui.model.json.JSONModel({
                        totalAmount: "0.00",
                        paymentOptions: [{
                            option: "Cash"
                        }, {
                            option: "Card"
                        }, {
                            option: "CreditNote"
                        }, {
                            option: "Advance Payment"
                        }, {
                            option: "Gift Voucher"
                        }, {
                            option: "Non-GV"
                        }, {
                            option: "Forex"
                        },
                    {
                            option: "View All Records"
                        }]
                    });
                    this.getView().setModel(oModel, "PaymentModel");

                    var cashData = [{
                        denomination: "",
                        qty: 0,
                        total: 0
                    }];

                    var oModel1 = new JSONModel({
                        "cashData": cashData,
                        "grandTotal": 0
                    });
                    this.getView().setModel(oModel1, "CashModel");

                    if (!this._oDialogPayment) {
                        Fragment.load({
                            name: "com.eros.salesprocess.fragment.payment",
                            controller: this
                        }).then(function (oFragment) {
                            this._oDialogPayment = oFragment;
                            this.getView().addDependent(this._oDialogPayment);
                            this.getView().getModel("ShowPaymentSection").setProperty("/selectedMode","");
                            sap.ui.getCore().byId("cashSbmtBtn").setEnabled(true);
                            sap.ui.getCore().byId("totalAmountText").setText(that.getView().byId("saleAmount").getCount());
                            saleAmount = that.getView().byId("saleAmount").getCount();
                            for (var count2 = 0; count2 < that.aPaymentEntries.length; count2++) {
                            paidAmount = parseFloat(parseFloat(that.aPaymentEntries[count2].Amount) + parseFloat(paidAmount)).toFixed(2);

                        }
                        balanceAmount = parseFloat(parseFloat(saleAmount).toFixed(2) - parseFloat(paidAmount).toFixed(2)).toFixed(2);
                        sap.ui.getCore().byId("totalSaleBalText").setText(balanceAmount);
                            this._oDialogPayment.open();
                            this._oDialogCashier.close();
                        }.bind(this));
                    } else {
                        this.getView().getModel("ShowPaymentSection").setProperty("/selectedMode","");
                        sap.ui.getCore().byId("cashSbmtBtn").setEnabled(true);
                        sap.ui.getCore().byId("totalAmountText").setText(that.getView().byId("saleAmount").getCount());
                        saleAmount = that.getView().byId("saleAmount").getCount();
                        for (var count1 = 0; count1 < that.aPaymentEntries.length; count1++) {
                            paidAmount = parseFloat(parseFloat(that.aPaymentEntries[count1].Amount) + parseFloat(paidAmount)).toFixed(2);

                        }
                        balanceAmount = parseFloat(parseFloat(saleAmount).toFixed(2) - parseFloat(paidAmount).toFixed(2)).toFixed(2);
                        sap.ui.getCore().byId("totalSaleBalText").setText(balanceAmount);
                         this._oDialogPayment.open();
                        this._oDialogCashier.close();
                    }
                }
                else {

                    if (!checkCustomer) {
                        MessageBox.error("Kindly enter Customer Details");

                    }
                    else if (!checkSerial) {
                        MessageBox.error("Kindly make sure to enter Serial Number for the item you have added");
                    }
                    else if (!discountAmount) {
                        MessageBox.error("Following Item Codes have negative Sale Amount:\n" + this.aNegativeItems.join(", "));
                    }
                    else if(!homeDelivery){
                        MessageBox.error("Kindly make sure to enter Shipping Instruction and Date for Home Delivery Item");
                    }
                    else if(!chckSalesman){
                        MessageBox.error("Following Item Codes does not have Salesman :\n" + this.aMissingSalesmanItems.join(", "));
                    }
                }
            },
            checkSalesman: function(){
                var that = this;
                var oTable = this.byId("idProductsTable");
                var aItems = oTable.getItems();
                var oModel = this.getView().getModel("ProductModel");
                this.aMissingSalesmanItems = [];
                aItems.forEach(function (oItem) {
                var oContext = oItem.getBindingContext("ProductModel");
                var oData = oContext.getObject();

                if (!oData.SalesmanId || oData.SalesmanId.trim() === "") {
                     that.aMissingSalesmanItems.push(oData.Itemcode);
                 }
                });
                if (that.aMissingSalesmanItems.length > 0) {
                    return false;
                }
                else{
                    return true;
                }

            },
            onPressDiscount1: function () {
                var oModel = new sap.ui.model.json.JSONModel({

                    DiscountList: [{
                        option: "Item List"
                    }, {
                        option: "Discounts Condition"
                    }, {
                        option: "Reason Type"
                    }, {
                        option: "Authority"
                    }, {
                        option: "Amount"
                    }, {
                        option: "View All Records"
                    }]
                });
                this.getView().setModel(oModel, "DiscountModel");

                var oModel1 = new sap.ui.model.json.JSONModel();
                this.getView().setModel(oModel1, "DiscountValue");



                if (!this._oDialogDiscoun1) {
                    Fragment.load({
                        name: "com.eros.salesprocess.fragment.discount1",
                        controller: this
                    }).then(function (oFragment) {
                        this._oDialogDiscoun1 = oFragment;
                        this.getView().addDependent(this._oDialogDiscoun1);

                        this._oDialogDiscoun1.open();

                    }.bind(this));
                } else {
                    this._oDialogDiscoun1.open();

                }
            },
            onAddRow: function () {
                var oModel = this.getView().getModel("CashModel");
                var cashData = oModel.getProperty("/cashData");

                cashData.push({
                    denomination: "",
                    qty: 0,
                    total: 0
                });

                oModel.setProperty("/cashData", cashData);
            },
            onDeleteRow: function (oEvent) {
                var oModel = this.getView().getModel("CashModel");
                var cashData = oModel.getProperty("/cashData");

                var oItem = oEvent.getSource().getParent();
                var oList = oItem.getParent();
                var index = oList.indexOfItem(oItem);

                cashData.splice(index, 1);

                oModel.setProperty("/cashData", cashData);

            },
            onOptionSelect: function (oEvent) {
                var sSelectedOption = oEvent.getSource().getTitle();
                var showSection = new JSONModel();
                showSection.setData({
                    "selectedMode": sSelectedOption
                });
                this.getView().setModel(showSection, "ShowSection");
                //	sap.m.MessageToast.show("Selected: " + sSelectedOption);
            },
            onDiscountSectSelected: function (oEvent) {
                var sSelectedOption = oEvent.getSource().getTitle();
                var showSection = new JSONModel();
                showSection.setData({
                    "selectedMode": sSelectedOption,

                });
                this.getView().setModel(showSection, "ShowDiscountSection");

                if (sSelectedOption === "View All Records") {
                    this.addDiscount();
                }
            },
            onOptionSelectPayment: function (oEvent) {
                var sSelectedOption = oEvent.getSource().getTitle();
                var showSection = new JSONModel();
                showSection.setData({
                    "selectedMode": sSelectedOption,
                    "cardPaymentMode": 0
                });
                if (sSelectedOption === "Cash") {
                    var cashModel = new JSONModel();
                    cashModel.setData({
                        "cash": [
                            {
                                "title": "1000",
                                "subtitle": "sap-icon://credit-card"
                            },
                            {
                                "title": "500",
                                "subtitle": "sap-icon://credit-card"
                            },
                            {
                                "title": "200",
                                "subtitle": "sap-icon://credit-card"
                            },
                            {
                                "title": "100",
                                "subtitle": "sap-icon://credit-card"
                            },
                            {
                                "title": "50",
                                "subtitle": "sap-icon://credit-card"
                            },
                            {
                                "title": "20",
                                "subtitle": "sap-icon://credit-card"
                            }


                        ]
                    })
                }
                this.getView().setModel(cashModel, "cashCurrencyModel");
                this.getView().setModel(showSection, "ShowPaymentSection");
                if (this.getView().getModel("AdvancePayment")) {
                    this.getView().getModel("AdvancePayment").setData({});
                    sap.ui.getCore().byId("advncePaymentList").setVisible(false);
                    sap.ui.getCore().byId("advPayment").setValue("");
                }
                if (this.getView().getModel("GiftVoucher")) {
                    this.getView().getModel("GiftVoucher").setData({});
                    sap.ui.getCore().byId("gvPaymentList").setVisible(false);
                    sap.ui.getCore().byId("giftVoucher").setValue("");
                }
                if (this.getView().getModel("CreditNote")) {
                    this.getView().getModel("CreditNote").setData({});
                    sap.ui.getCore().byId("creditNoteList").setVisible(false);
                    sap.ui.getCore().byId("creditNote").setValue("");

                }
                if (sSelectedOption === "View All Records"){
                    this.getView().getModel("ShowPaymentSection").setProperty("/allEntries",this.aPaymentEntries)
                }
            },
            onPressCard: function () {
                var model = new JSONModel();
                model.setData({
                    "selectedMode": "CardsView"
                });
                this.getView().setModel(model, "ShowCardsSection");
            },
            onPressClose: function () {
                this._oDialogPayment.close();
            },
            onPrintTransaction: function () {
                window.print();
            },
            onPressCustData: function () {
                var oModel = new sap.ui.model.json.JSONModel({
                    customerData: [{
                        option: "Basic Information"
                    }, {
                        option: "Customer Address"
                    }, {
                        option: "Shipping Instruction"
                    }
                    ]
                });
                this.getView().setModel(oModel, "CustModel");





                if (!this._oDialogCust) {
                    Fragment.load({
                        name: "com.eros.salesprocess.fragment.customer",
                        controller: this
                    }).then(function (oFragment) {
                        this._oDialogCust = oFragment;
                        this.getView().addDependent(this._oDialogCust);
                        this._oDialogCust.open();
                    }.bind(this));
                } else {
                    this._oDialogCust.open();
                }

            },
            onAfterRendering: function () {
                var oTable = this.getView().byId("idProductsTable");
                if (oTable) {
                    setTimeout(function () {
                        oTable.$().find(".sapMListTblHeader").css({
                            "background-color": "#A9A9A9",
                            "color": "white"
                        });
                    }, 500); // Delayed execution ensures correct rendering
                }
            },

            onPressCustClose: function () {
                this._oDialogCust.close();
            },
            onPressCustSaveClose: function () {
                this.shippingAddress = "";
                this.shippingDate = "";
                this.shippingInst = "";

                var custData = this.getView().getModel("custAddModel").getData();
                var bFlag = this.validateCustomer();
                var addressParts = [];
                var customerName = [];

                if (custData.ShippingMethod === 0) {
                    this.shippingMethod = "HD";
                } else if (custData.ShippingMethod === 1) {
                    this.shippingMethod = "HA";
                } else if (custData.ShippingMethod === 2) {
                    this.shippingMethod = "HP";
                }

                if (custData.FirstName) {
                    customerName.push(custData.FirstName);
                }
                if (custData.LastName) {
                    customerName.push(custData.LastName);
                }
                var custName = customerName.join(" ");
                this.getView().byId("customer").setCount(custName);
                var selAddIndex = sap.ui.getCore().byId("addressRbGrp").getSelectedIndex();
                if (selAddIndex === 0) {

                    if (custData.HomeAddressLine1) {
                        addressParts.push(custData.HomeAddressLine1);
                    }
                    if (custData.HomeAddressLine2) {
                        addressParts.push(custData.HomeAddressLine2);
                    }
                    if (custData.HomeStreet) {
                        addressParts.push(custData.HomeStreet);
                    }
                    if (custData.HomeCity) {
                        addressParts.push(custData.HomeCity);
                    }
                    if (custData.HomeCountry) {
                        addressParts.push(custData.HomeCountry);
                    }

                }
                else if (selAddIndex === 1) {

                    if (custData.OfficeAddressLine1) {
                        addressParts.push(custData.OfficeAddressLine1);
                    }
                    if (custData.OfficeAddressLine2) {
                        addressParts.push(custData.OfficeAddressLine2);
                    }
                    if (custData.OfficeStreet) {
                        addressParts.push(custData.OfficeStreet);
                    }
                    if (custData.off_City) {
                        addressParts.push(custData.OfficeCity);
                    }
                    if (custData.off_Country) {
                        addressParts.push(custData.OfficeCountry);
                    }



                } else {

                    if (custData.OtherAddressLine1) {
                        addressParts.push(custData.OtherAddressLine1);
                    }
                    if (custData.OtherAddressLine2) {
                        addressParts.push(custData.OtherAddressLine2);
                    }
                    if (custData.oth_po) {
                        addressParts.push(custData.OtherStreet);
                    }
                    if (custData.oth_City) {
                        addressParts.push(custData.OtherCity);
                    }
                    if (custData.oth_Country) {
                        addressParts.push(custData.OtherCountry);
                    }



                }
                this.shippingAddress = addressParts.join(" ");



                if (custData.shippingDate) {
                    var date = new Date(custData.shippingDate);
                    var pad = (n) => String(n).padStart(2, '0');
                    // this.shippingDate = `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}`;
                    this.shippingDate = custData.shippingDate;
                }

                if (custData.ShippingInst) {
                    this.shippingInst = custData.ShippingInst;
                }



                if (bFlag) {
                    this.updateCustomer();
                }

                // this._oDialogCust.close();

            },
            validateCustomer: function () {
                var bFlag;
                var checkDelivery = this.checkHomeDelivery();
                var custData = this.getView().getModel("custAddModel").getData();
                var errorMessage = "";

                // Basic Required Fields
                if (!custData.FirstName || custData.FirstName.trim() === "") {
                    errorMessage += "First Name is required.\n";
                }
                if (!custData.Code || custData.Code.trim() === "") {
                    errorMessage += "Country Code is required.\n";
                }
                if (!custData.Mobile || custData.Mobile.trim() === "") {
                    errorMessage += "Mobile Number is required.\n";
                }
                if (!custData.CustomerType || custData.CustomerType.trim() === "") {
                    errorMessage += "Customer Type is required.\n";
                }

                // Additional fields for Tourist (CustType === "2")
                if (custData.CustomerType === "TOURIST") {
                    if (!custData.IdentityType || custData.IdentityType.trim() === "") {
                        errorMessage += "Identity Type is required for Tourists.\n";
                    }
                    if (!custData.IdentityIssuedBy || custData.IdentityIssuedBy.trim() === "") {
                        errorMessage += "Identity Document Issued By is required for Tourists.\n";
                    }
                    if (!custData.IdentityNumber || custData.IdentityNumber.trim() === "") {
                        errorMessage += "Identity Document Number is required for Tourists.\n";
                    }
                    if (!custData.Residence || custData.Residence.trim() === "") {
                        errorMessage += "Identity Document Number is required for Tourists.\n";
                    }
                    if (!custData.Nationality || custData.Nationality.trim() === "") {
                        errorMessage += "Identity Document Number is required for Tourists.\n";
                    }
                }

                if (checkDelivery === "HD") {
                    if (!custData.shippingDate || custData.shippingDate === "") {
                        errorMessage += "Shipping Date is required for Home Delivery.\n";
                    }
                    if (!custData.ShippingInst || custData.ShippingInst.trim() === "") {
                        errorMessage += "Shipping Instruction is required for Home Delivery.\n";
                    }
                }

                // Show message if there are errors
                if (errorMessage.length > 0) {
                    sap.m.MessageBox.error(errorMessage);
                    bFlag = false;
                }
                else {
                    bFlag = true;
                }

                return bFlag;


            },
            updateCustomer: function () {
                var that = this;
                var data = this.getView().getModel("custAddModel").getData();

                var shippingDate = data.shippingDate;
                var shipingInst = data.ShippingInst;
                var shipingMethod = data.ShippingMethod;
                delete (data.shippingDate);
                delete (data.ShippingInst);
                delete (data.ShippingMethod);

                var birthDate = sap.ui.getCore().byId("birthDate").getValue();
        var expiryDate = sap.ui.getCore().byId("expiryDate").getValue();

        if (birthDate) {
            data.BirthDate =new Date(birthDate);
        }
        else {
            data.BirthDate = null;
        }
        if (expiryDate) {
            data.IdentityExpiry = new Date(expiryDate);
        }
        else {
            data.IdentityExpiry = null;
        }
                this.oModel.create("/CustomerSet", data, {
                    success: function (oData,response) {
                        that.getView().getModel("custAddModel").setData({});
                        that.getView().getModel("custAddModel").setData(oData);
                        that.getView().getModel("custAddModel").setProperty("/shippingDate", shippingDate);
                        that.getView().getModel("custAddModel").setProperty("/ShippingInst", shipingInst);
                        that.getView().getModel("custAddModel").setProperty("/ShippingMethod", shipingMethod);
                        that._oDialogCust.close();
                        sap.m.MessageToast.show("Customer Update Successfully");
                    },
                    error: function (oError) {
                        sap.m.MessageToast.show("Error while Updating Customer");

                    }
                });

            },
            onPressTender: function (oEvent) {
                var oMultiInput = sap.ui.getCore().byId("multiInput");

                var oToken = new sap.m.Token({
                    key: this.token.toString() + "_" + oEvent.getParameter("srcControl").getAggregation("items")[0].getProperty("text"),
                    text: oEvent.getParameter("srcControl").getAggregation("items")[0].getProperty("text")
                });

                this.token++;
                oMultiInput.addToken(oToken);
            },
            onSubtract: function (oEvent) {
                var oTable = this.getView().byId("idProductsTable");
                var selIndex = oEvent.getSource().getId().split("--")[2].split("-")[1];
                var selIndexData = this.getView().getModel("ProductModel").getObject("/Product/" + selIndex);
                var balanceStock = selIndexData.Balancestock;
                var qtyValue = oEvent.getSource().getEventingParent().getItems()[1].getValue();
                var iValue = parseInt(qtyValue, 10) || 0;
                if (iValue > 0) {
                    oEvent.getSource().getEventingParent().getItems()[1].setValue(iValue - 1);
                    var itemQty = oEvent.getSource().getEventingParent().getItems()[1].getValue();
                    if(parseInt(itemQty) !== 0){
                    if ((parseInt(itemQty) < parseInt(balanceStock))) {
                        this.reservedItemonAdditnSub(selIndexData, "sub");
                        this.getView().getModel("ProductModel").getObject("/Product/" + selIndex).NetAmount = parseFloat(parseFloat(selIndexData.UnitPrice).toFixed(2) * parseFloat(itemQty).toFixed(2)).toFixed(2);
                        this.getView().getModel("ProductModel").getObject("/Product/" + selIndex).NetDiscount = parseFloat(parseFloat(selIndexData.Discount).toFixed(2) * parseFloat(itemQty).toFixed(2)).toFixed(2);
                        var netAmount = this.getView().getModel("ProductModel").getObject("/Product/" + selIndex).NetAmount;
                        var netDiscount = this.getView().getModel("ProductModel").getObject("/Product/" + selIndex).NetDiscount
                        var vatPercent = this.getView().getModel("ProductModel").getObject("/Product/" + selIndex).VatPercent
                        // this.getView().getModel("ProductModel").getObject("/Product/" + selIndex).NetAmount= parseFloat(parseFloat(netAmount) + parseFloat(netDiscount)).toFixed(2);
                        this.calculateVATAmount(netAmount, netDiscount, vatPercent, selIndex);
                        this.calculateSalesAmount(netAmount, netDiscount, vatPercent, selIndex);
                    }
                    else {
                        sap.m.MessageBox.show(
                            "Entered Quantity should not be more than Balance Stock", {
                            icon: sap.m.MessageBox.Icon.Error,
                            title: "Error",
                            actions: ["OK"],
                            onClose: function (oAction) {


                            }
                        }
                        );
                    }
                }else{
                    sap.m.MessageBox.confirm("Do you want to delete the Item, press Ok to Continue or Cancel",
                        {
                            actions: ["OK", "CANCEL"],
				            onClose: function (sAction) {
					           if(sAction  === "OK"){
                                var oItemToDelete = oTable.getItems()[selIndex];
                                oTable.fireDelete({ listItem: oItemToDelete });
                               }
                               else{
                                oEvent.getSource().getEventingParent().getItems()[1].setValue(1);
                                oEvent.getSource().getEventingParent().getItems()[1].getSource().fireChange();
                               }
				            }
                        })
                }

                }

            },
            onManualChangeQty: function (oEvent) {
                var event = oEvent;
                var oTable = this.getView().byId("idProductsTable");
                var qty = oEvent.getParameter("newValue");
                var selIndex = oEvent.getSource().getParent().getId().split("--")[2].split("-")[1];
                var selIndexData = this.getView().getModel("ProductModel").getObject("/Product/" + selIndex);
                var balanceStock = selIndexData.Balancestock;

                if (!qty) {
                    qty = selIndexData.SaleQuantity.toString();
                }

                if ((qty !== "0")) {
                    if ((parseInt(qty) <= parseInt(balanceStock))) {
                        this.reservedItemonAdditnSub(selIndexData, "manual");
                        var qtyValue = qty;
                        var iValue = parseInt(qtyValue, 10) || 0;
                        selIndexData.NetAmount = parseFloat(parseFloat(selIndexData.UnitPrice).toFixed(2) * parseFloat(iValue).toFixed(2)).toFixed(2);
                        selIndexData.NetDiscount = parseFloat(parseFloat(selIndexData.Discount).toFixed(2) * parseFloat(iValue).toFixed(2)).toFixed(2);

                        var netAmount = selIndexData.NetAmount;
                        var netDiscount = selIndexData.NetDiscount
                        var vatPercent = selIndexData.VatPercent
                        // selIndexData.NetAmount= parseFloat(parseFloat(netAmount) + parseFloat(netDiscount)).toFixed(2);
                        this.calculateVATAmount(netAmount, netDiscount, vatPercent, selIndex);
                        this.calculateSalesAmount(netAmount, netDiscount, vatPercent, selIndex);
                    }
                    else {
                        sap.m.MessageBox.confirm("Do you want to delete the Item, press Ok to Continue or Cancel",
                             {
                            title: "Confirmation",
                            actions: ["OK", "CANCEL"],
                            onClose: function (sAction) {
                                 if(sAction  === "OK"){
                                var oItemToDelete = oTable.getItems()[selIndex];
                                oTable.fireDelete({ listItem: oItemToDelete });
                               }
                               else{
                                event.getSource().setValue(1);
                                event.getSource().fireChange();
                               }
                               

                            }
                        }
                        );

                    }
                }
                else {
                    sap.m.MessageBox.confirm("Do you want to delete the Item, press Ok to Continue or Cancel",
                             {
                            title: "Confirmation",
                            actions: ["OK", "CANCEL"],
                            onClose: function (sAction) {
                                 if(sAction  === "OK"){
                                var oItemToDelete = oTable.getItems()[selIndex];
                                oTable.fireDelete({ listItem: oItemToDelete });
                               }
                               else{
                                event.getSource().setValue(1);
                                event.getSource().fireChange();
                               }
                               

                            }
                        }
                        );
                }


            },
            onAddition: function (oEvent) {
                var that = this;
                var event = oEvent;
                var selIndex = oEvent.getSource().getId().split("--")[2].split("-")[1];
                var selIndexData = this.getView().getModel("ProductModel").getObject("/Product/" + selIndex);
                this.oControl = oEvent.getSource().getEventingParent().getItems()[1];
                var qtyValue = oEvent.getSource().getEventingParent().getItems()[1].getValue();
                var balanceStock = selIndexData.Balancestock;
                var iValue = parseInt(qtyValue, 10) || 0;
                oEvent.getSource().getEventingParent().getItems()[1].setValue(iValue + 1);
                var itemQty = oEvent.getSource().getEventingParent().getItems()[1].getValue();
                if ((parseInt(itemQty) <= parseInt(balanceStock))) {
                    this.reservedItemonAdditnSub(selIndexData, "add");
                    this.getView().getModel("ProductModel").getObject("/Product/" + selIndex).NetAmount = parseFloat(parseFloat(selIndexData.UnitPrice).toFixed(2) * parseFloat(itemQty).toFixed(2)).toFixed(2);
                    this.getView().getModel("ProductModel").getObject("/Product/" + selIndex).NetDiscount = parseFloat(parseFloat(selIndexData.Discount).toFixed(2) * parseFloat(itemQty).toFixed(2)).toFixed(2);

                    var netAmount = this.getView().getModel("ProductModel").getObject("/Product/" + selIndex).NetAmount;
                    var netDiscount = this.getView().getModel("ProductModel").getObject("/Product/" + selIndex).NetDiscount
                    var vatPercent = this.getView().getModel("ProductModel").getObject("/Product/" + selIndex).VatPercent
                    // this.getView().getModel("ProductModel").getObject("/Product/" + selIndex).NetAmount= parseFloat(parseFloat(netAmount) + parseFloat(netDiscount)).toFixed(2);
                    this.calculateVATAmount(netAmount, netDiscount, vatPercent, selIndex);
                    this.calculateSalesAmount(netAmount, netDiscount, vatPercent, selIndex);
                }
                else {
                    sap.m.MessageBox.show(
                        "Entered Quantity should not be more than Balance Stock", {
                        icon: sap.m.MessageBox.Icon.Error,
                        title: "Error",
                        actions: ["OK"],
                        onClose: function (oAction) {
                            that.oControl.setValue(qtyValue);
                            that.oControl.getSource().fireChange();
                        }
                    }
                    );
                }

            },
            calculateSalesAmount: function (netAmount, netDiscount, vatPercent, selIndex) {
                var netPrice = parseFloat(parseInt(parseFloat(netAmount).toFixed(2)) + parseInt(parseFloat(netDiscount).toFixed(2))).toFixed(2);
                var vatAmount = parseFloat(parseInt(netPrice) * (parseInt(parseFloat(vatPercent).toFixed(2)) / 100)).toFixed(2);
                this.getView().getModel("ProductModel").getObject("/Product/" + selIndex).SaleAmount = parseFloat(vatAmount) + parseFloat(netPrice);
                this.getView().getModel("ProductModel").refresh();
            },
            calculateVATAmount: function (netAmount, netDiscount, vatPercent, selIndex) {
                var netPrice = parseFloat(parseInt(parseFloat(netAmount).toFixed(2)) + parseInt(parseFloat(netDiscount).toFixed(2))).toFixed(2);
                var vatAmount = parseFloat(parseInt(netPrice) * (parseInt(parseFloat(vatPercent).toFixed(2)) / 100)).toFixed(2);
                this.getView().getModel("ProductModel").getObject("/Product/" + selIndex).VatAmount = vatAmount;
                this.getView().getModel("ProductModel").refresh();

            },
            formatVatAmount: function (unitPrice, unitDiscount, vatPercent, vatAmount, seq) {

                if (parseFloat(vatAmount).toFixed(2) === "0.00") {
                    var netPrice = parseFloat(parseInt(parseFloat(unitPrice).toFixed(2)) + parseInt(parseFloat(unitDiscount).toFixed(2))).toFixed(2);
                    var vatAmount = parseFloat(parseInt(netPrice) * (parseInt(parseFloat(vatPercent).toFixed(2)) / 100)).toFixed(2);
                    this.getView().getModel("ProductModel").getObject("/Product/" + (seq / 10 - 1)).VatAmount = vatAmount;
                    this.getView().getModel("ProductModel").getObject("/Product/" + (seq / 10 - 1)).NetDiscount = unitDiscount;
                    this.getView().getModel("ProductModel").refresh();

                    return vatAmount;
                }
                else {

                    return vatAmount;
                }

            },
            formatSalesAmount: function (unitPrice, unitDiscount, vatPercent, vatAmount, salesAmount, seq) {

                if (parseFloat(salesAmount).toFixed(2) === "0.00") {
                    var netPrice = parseFloat(parseInt(parseFloat(unitPrice).toFixed(2)) + parseInt(parseFloat(unitDiscount).toFixed(2))).toFixed(2);
                    var vatAmount = parseFloat(parseInt(netPrice) * (parseInt(parseFloat(vatPercent).toFixed(2)) / 100)).toFixed(2);
                    this.getView().getModel("ProductModel").getObject("/Product/" + (seq / 10 - 1)).NetDiscount = unitDiscount;
                    this.getView().getModel("ProductModel").getObject("/Product/" + (seq / 10 - 1)).SaleAmount = parseFloat(parseFloat(vatAmount) + parseFloat(netPrice)).toFixed(2);
                    this.getView().getModel("ProductModel").refresh();
                    this.setHeaderData();
                    return parseFloat(parseFloat(vatAmount) + parseFloat(netPrice)).toFixed(2);

                }
                else {

                    this.setHeaderData();
                    return parseFloat(salesAmount).toFixed(2);
                }

            },
            setHeaderData: function () {
                var items = that.getView().getModel("ProductModel").getProperty("/Product");
                var totalQty = 0;
                var totalAmount = 0;
                var totalDiscount = 0;
                var totalVAT = 0;
                var totalSaleAmount = 0;

                for (var count = 0; count < items.length; count++) {

                    totalQty = totalQty + parseFloat(items[count].SaleQuantity);
                    totalVAT = parseFloat(parseFloat(totalVAT) + parseFloat(items[count].VatAmount)).toFixed(2);
                    totalSaleAmount = parseFloat(parseFloat(totalSaleAmount) + parseFloat(items[count].SaleAmount)).toFixed(2);
                    totalAmount = parseFloat(parseFloat(totalAmount) + parseFloat(items[count].NetAmount)).toFixed(2);
                    totalDiscount = parseFloat(parseFloat(totalDiscount) + parseFloat(items[count].NetDiscount)).toFixed(2);

                }

                this.getView().byId("qty").setCount(totalQty);
                this.getView().byId("gross").setCount(totalAmount);
                this.getView().byId("discount").setCount(totalDiscount);
                this.getView().byId("vat").setCount(totalVAT);
                this.getView().byId("saleAmount").setCount(totalSaleAmount);

            },
            OnSignaturePress: function () {
                var that = this,
                    oView = this.getView();
                if (!this._pAddRecordDialog) {
                    this._pAddRecordDialog = Fragment.load({
                        id: oView.getId(),
                        name: "com.eroserospos.Fragment.signaturePad",
                        controller: this,
                    }).then(function (oValueHelpDialog) {
                        oView.addDependent(oValueHelpDialog);
                        return oValueHelpDialog;
                    });
                }

                this._pAddRecordDialog.then(
                    function (oValueHelpDialog) {
                        that.onClear();
                        oValueHelpDialog.open();
                    }.bind(that)
                );
            },
            onClear: function () {
                sap.ui.core.Fragment.byId(this.getView().getId(), "idSignaturePad").clear();
                sap.ui.core.Fragment.byId(this.getView().getId(), "idName").setValue("");
                sap.ui.core.Fragment.byId(this.getView().getId(), "idStaff").setValue("");
                sap.ui.core.Fragment.byId(this.getView().getId(), "idComments").setValue("");
            },
            onDialogClose: function () {
                this.onClear();
                this._pAddRecordDialog.then(
                    function (oValueHelpDialog) {
                        oValueHelpDialog.close();
                    }.bind(this)
                );

                this.onPDFDialogClose();

            },
            onPressAddButton: function (oEvent) {
                var oTable = oEvent.getSource().getParent().getContent()[0].getItems()[0];
                var sPath = oTable.getSelectedContextPaths();
                var itemData = that.getView().getModel("StockGlobalModel").getObject(sPath[0]);

                if (parseInt(itemData.Balancestock) > 0) {
                    this.reservedItemGlobalLocation(itemData);
                    that._oDialogGlobalStock.close();
                }
                else {
                    MessageBox.error("No Stock is available for this Location. Kindly select other location");
                }

            },
            onPressCloseStock: function () {
                that._oDialogGlobalStock.close();
            },
            openAllLocationMatInfo: function (oEvent) {
                var that = this;
                var event = oEvent;
                that.switch = oEvent.getSource();
                var oTable = this.getView().byId("idProductsTable");
                var tableData = that.getView().getModel("ProductModel").getProperty("/Product");
                this.sPathOpenAllLocation = oEvent.getSource().getParent().oBindingContexts.ProductModel.sPath;
                var itemData = that.getView().getModel("ProductModel").getObject(this.sPathOpenAllLocation);
                var aFilters = [];
                aFilters.push(new sap.ui.model.Filter("Itemcode", sap.ui.model.FilterOperator.EQ, itemData.Itemcode));
                if (oEvent.mParameters.state) {
                    aFilters.push(new sap.ui.model.Filter("AllLocations", sap.ui.model.FilterOperator.EQ, "X"));
                }

                if (oEvent.mParameters.state) {
                    this.oModel.read("/MaterialSet", {
                        urlParameters: {
                            "$expand": "ToDiscounts"
                        },
                        filters: aFilters,
                        success: function (oData) {
                            if (oData.results.length > 0) {
                                for (var count = 0; count < oData.results.length; count++) {
                                    oData.results[count].SaleQuantity = 1;
                                    oData.results[count].HomeDelivery = true;
                                    oData.results[count].NetAmount = oData.results[count].NetPrice;
                                }
                                that.homeDelModel = new JSONModel({ Product: [] });
                                that.getView().setModel(that.homeDelModel, "HomeDelModel");
                                var aProducts = that.getView().getModel("HomeDelModel").getProperty("/Product");
                                aProducts.push(...oData.results);
                                that.getView().getModel("HomeDelModel").setProperty("/Product", aProducts);
                                if (!that._oHomeDelMat) {
                                    Fragment.load({
                                        name: "com.eros.salesprocess.fragment.homeDeliveryMaterial",
                                        controller: that
                                    }).then(function (oFragment) {
                                        that._oHomeDelMat = oFragment;
                                        that.getView().addDependent(that._oHomeDelMat);
                                        that._oHomeDelMat.open();
                                    }.bind(that));
                                } else {
                                    that._oHomeDelMat.open();
                                }


                            }

                        },
                        error: function (oError) {

                            sap.m.MessageBox.show(
                                JSON.parse(oError.responseText).error.message.value, {
                                icon: sap.m.MessageBox.Icon.Error,
                                title: "Error",
                                actions: ["OK", "CANCEL"],
                                onClose: function (oAction) {

                                }
                            }
                            );

                        }
                    });
                }
                else {
                    sap.m.MessageBox.confirm("Item will get deleted from the list. You have to add it again, press Ok to Continue or Cancel",
                        {
                            actions: ["OK", "CANCEL"],
				            onClose: function (sAction) {
					           if(sAction  === "OK"){
                                var oItemToDelete = oTable.getItems()[that.sPathOpenAllLocation.split("/Product/")[1]];
                                oTable.fireDelete({ listItem: oItemToDelete });
                               }
                               else{
                                that.switch.setState(true);
                               }
				            }
                        })
                    // this.oModel.read("/MaterialSet", {
                    //     urlParameters: {
                    //         "$expand": "ToDiscounts"
                    //     },
                    //     filters: aFilters,
                    //     success: function (oData) {
                    //         if (oData.results.length > 0) {
                    //             that.getView().getModel("ProductModel").getObject(that.sPathOpenAllLocation).Location = oData.results[0].Location;
                    //             that.getView().getModel("ProductModel").getObject(that.sPathOpenAllLocation).LocationName = oData.results[0].LocationName;
                    //             that.getView().getModel("ProductModel").getObject(that.sPathOpenAllLocation).SaleQuantity = 1;
                    //             that.getView().getModel("ProductModel").getObject(that.sPathOpenAllLocation).NetPrice = oData.results[0].NetPrice;
                    //             that.getView().getModel("ProductModel").getObject(that.sPathOpenAllLocation).Discount = oData.results[0].Discount;
                    //             that.getView().getModel("ProductModel").getObject(that.sPathOpenAllLocation).Plant = oData.results[0].Plant;
                    //             that.getView().getModel("ProductModel").getObject(that.sPathOpenAllLocation).NetAmount = parseFloat(parseFloat(oData.results[0].NetPrice).toFixed(2) * parseFloat(1).toFixed(2)).toFixed(2);
                    //             that.getView().getModel("ProductModel").refresh(true);
                    //         }

                    //     },
                    //     error: function (oError) {

                    //         sap.m.MessageBox.show(
                    //             JSON.parse(oError.responseText).error.message.value, {
                    //             icon: sap.m.MessageBox.Icon.Error,
                    //             title: "Error",
                    //             actions: ["OK", "CANCEL"],
                    //             onClose: function (oAction) {
                    //                 that.switch.setState(true);
                    //             }
                    //         }
                    //         );

                    //     }
                    // });
                }
            },
            onSelectHomeDelivery: function (oEvent) {

                var itemData = this.getView().getModel("ProductModel").getObject(this.sPathOpenAllLocation);
                var homeDelData = this.getView().getModel("HomeDelModel").getObject(oEvent.getSource().getParent().getContent()[0].getItems()[0].getSelectedContextPaths()[0]);
                this.removeReservation(itemData);
                itemData.Location = homeDelData.Location;
                itemData.LocationName = homeDelData.LocationName;
                itemData.Plant = homeDelData.Plant;

                this.reservedItemonHomeDel(homeDelData);
                this.getView().getModel("ProductModel").refresh();
                that._oHomeDelMat.close();
            },
            removeReservation: function (data) {
                var that = this;
                var oPayload = {
                    "TransactionId": this.getView().byId("tranNumber").getCount(),
                    "ReservedFlag": "D",
                    "Material": data.Itemcode,
                    "Plant": data.Plant,
                    "Location": data.Location,
                    "Quantity": data.SaleQuantity.toString(),
                    "ReservationNo": "",
                    "Type": "",
                    "Status": ""

                }

                this.oModel.create("/ReservationSet", oPayload, {
                    success: function (oData) {
                        sap.m.MessageToast.show("Reservation of Existing Item has been removed");


                    },
                    error: function (oError) {
                        sap.m.MessageToast.show("Error in Deleting the Reserving of the item");
                    }
                });
            },
            reservedItemonHomeDel: function (data) {
                var that = this;
                var oPayload = {
                    "TransactionId": this.getView().byId("tranNumber").getCount(),
                    "ReservedFlag": "I",
                    "Material": data.Itemcode,
                    "Plant": data.Plant,
                    "Location": data.Location,
                    "Quantity": data.SaleQuantity.toString(),
                    "ReservationNo": "",
                    "Type": "",
                    "Status": ""

                }

                this.oModel.create("/ReservationSet", oPayload, {
                    success: function (oData) {

                        var tableData = that.getView().getModel("ProductModel").getProperty("/Product");
                        var bFlag = false;
                        for (var count = 0; count < tableData.length; count++) {

                            if ((tableData[count].Itemcode === data.Itemcode) && (tableData[count].Location === data.Location)) {
                                if (table[count]) {
                                    data.Seq = table[count].Seq;
                                }
                                tableData[count] = {};
                                tableData[count] = data;
                                bFlag = true;
                            }
                        }

                    },
                    error: function (oError) {
                        sap.m.MessageToast.show("Error in Reserving the item");
                    }
                });
            },
            onPressCancelHomeDelivery: function () {
                that._oHomeDelMat.close();
            },
            onSuggest: function (oEvent) {
                var that = this;
                this.openMessageBox = false;
                var sValue = "";

                if (oEvent.getParameter("suggestValue")) {
                    sValue = oEvent.getParameter("suggestValue");
                }
                else if (oEvent.getParameter("value")) {
                    sValue = oEvent.getParameter("value");
                }
                // var oInput = oEvent.getSource();
                // var oSuggestionPopup = oInput._getSuggestionsPopover().getPopover();
                // oSuggestionPopup.setPlacement(PlacementType.Right);
                if (sValue.length > 0) { // Suggest only when user types 3 or more characters
                    var aFilters = [new sap.ui.model.Filter("Itemcode", sap.ui.model.FilterOperator.Contains, sValue)];
                    this.oModel.read("/MaterialSet", {
                        urlParameters: {
                            "$expand": "ToDiscounts"
                        },
                        filters: aFilters,
                        success: function (oData) {
                            if (oData.results.length > 0) {

                                var oSuggestionModel = new sap.ui.model.json.JSONModel({ suggestions: [] });
                                oSuggestionModel.setProperty("/suggestions", oData.results);
                                that.getView().setModel(oSuggestionModel, "suggestionModel");

                            }

                        },
                        error: function (oError) {
                            aFilters.push(new sap.ui.model.Filter("AllLocations", sap.ui.model.FilterOperator.EQ, "X"));
                            if (JSON.parse(oError.responseText).error.code === "MATERIAL_CHECK") {
                                if (!that.openMessageBox) {
                                    sap.m.MessageBox.show(
                                        "Item is not available at this store location. Do you want to check other locations?", {
                                        icon: sap.m.MessageBox.Icon.INFORMATION,
                                        title: "Availability Check",
                                        actions: ["OK", "CANCEL"],
                                        onClose: function (oAction) {
                                            if (oAction === "OK") {
                                                that.openMessageBox = true;
                                                that.getMaterialAllLocation(aFilters);


                                            } else {

                                            }
                                        }
                                    }
                                    );
                                }
                            }
                            else {
                                sap.m.MessageBox.show(
                                    JSON.parse(oError.responseText).error.message.value, {
                                    icon: sap.m.MessageBox.Icon.Error,
                                    title: "Error",
                                    actions: ["OK", "CANCEL"],
                                    onClose: function (oAction) {

                                    }
                                }
                                );
                            }
                            console.error("Error", oError);
                        }
                    });

                }
            },
            onSuggestionSelected: function (oEvent) {
                var that = this;
                var oSelectedRow = oEvent.getParameter("selectedRow");
                if (oSelectedRow) {
                    var oContext = oSelectedRow.getBindingContext("suggestionModel");
                    var sItemCode = oContext.getProperty("Itemcode");
                    var sOnHandsStock = oContext.getProperty("Balancestock");

                    if (parseInt(sOnHandsStock) <= 0) {
                        var aFilters = [new sap.ui.model.Filter("Itemcode", sap.ui.model.FilterOperator.Contains, sItemCode),
                        new sap.ui.model.Filter("AllLocations", sap.ui.model.FilterOperator.Contains, "X")]
                        sap.m.MessageBox.show(
                            "Item is not available at this store location. Do you want to check other locations?", {
                            icon: sap.m.MessageBox.Icon.INFORMATION,
                            title: "Availability Check",
                            actions: ["OK", "CANCEL"],
                            onClose: function (oAction) {
                                if (oAction === "OK") {

                                    that.getMaterialAllLocation(aFilters);


                                } else {

                                }
                            }
                        }
                        );

                    } else {
                        this.getMaterialDetail(true, sItemCode);
                    }

                }
            },
            onSuggestionStockSelected: function (oEvent) {
                var that = this;
                var oSelectedRow = oEvent.getParameter("selectedRow");
                if (oSelectedRow) {
                    var oContext = oSelectedRow.getBindingContext("suggestionModel");
                    var sItemCode = oContext.getProperty("Itemcode");

                    this.getStockDetail(true, sItemCode);

                }
            },
            reservedItemOwnLocation: function (data) {
                var that = this;
                var oPayload = {
                    "TransactionId": this.getView().byId("tranNumber").getCount(),
                    "ReservedFlag": "I",
                    "Material": data[0].Itemcode,
                    "Plant": data[0].Plant,
                    "Location": data[0].Location,
                    "Quantity": data[0].SaleQuantity.toString(),
                    "ReservationNo": "",
                    "Type": "",
                    "Status": ""

                }

                this.oModel.create("/ReservationSet", oPayload, {
                    success: function (oData) {

                        var tableData = that.getView().getModel("ProductModel").getProperty("/Product");
                        var bFlag = false;
                        for (var count = 0; count < tableData.length; count++) {

                            if ((tableData[count].Itemcode === data[0].Itemcode) && (tableData[count].Location === data[0].Location)) {
                                that.getView().getModel("ProductModel").setProperty("/Product/" + count + "/SaleQuantity", parseInt(tableData[count].SaleQuantity) + 1);
                                that.getView().getModel("ProductModel").setProperty("/Product/" + count + "/NetAmount", parseFloat(parseFloat(tableData[count].UnitPrice).toFixed(2) * parseFloat(tableData[count].SaleQuantity).toFixed(2)).toFixed(2));
                                that.getView().getModel("ProductModel").setProperty("/Product/" + count + "/NetDiscount", parseFloat(parseFloat(tableData[count].Discount).toFixed(2) * parseFloat(tableData[count].SaleQuantity).toFixed(2)).toFixed(2));
                                that.getView().getModel("ProductModel").setProperty("/MaterialCode", "");

                                var netAmount = that.getView().getModel("ProductModel").getProperty("/Product/" + count + "/NetAmount");
                                var netDiscount = that.getView().getModel("ProductModel").getProperty("/Product/" + count + "/NetDiscount");
                                var vatPercent = that.getView().getModel("ProductModel").getProperty("/Product/" + count + "/VatPercent");
                                that.calculateVATAmount(netAmount, netDiscount, vatPercent, count);
                                that.calculateSalesAmount(netAmount, netDiscount, vatPercent, count);
                                bFlag = true;
                            }
                        }
                        if (!bFlag) {
                            var aProducts = that.getView().getModel("ProductModel").getProperty("/Product");
                            aProducts.push(...data);
                            that.updateSeq(aProducts);
                            that.checkEnableDisableTile(true);
                            //that.getView().getModel("ProductModel").setProperty("/Product", aProducts);
                            that.getView().getModel("ProductModel").setProperty("/MaterialCode", "");

                            that.backupProdArr.push({
                                "MatCode": data[0].Itemcode,
                                "LocId": data[0].Location,
                                "LocName": data[0].LocationName

                            })
                        }
                    },
                    error: function (oError) {
                        sap.m.MessageToast.show("Error in Reserving the item");
                        sap.m.MessageBox.show(JSON.parse(oError.responseText).error.message.value, {
                            icon: sap.m.MessageBox.Icon.Error,
                            title: "Error",
                            actions: [MessageBox.Action.OK],
                            onClose: function (oAction) {
                                if (oAction === MessageBox.Action.OK) {

                                }
                            }
                        });

                    }
                });
            },
            reservedItemGlobalLocation: function (data) {
                var that = this;
                var oPayload = {
                    "TransactionId": this.getView().byId("tranNumber").getCount(),
                    "ReservedFlag": "I",
                    "Material": data.Itemcode,
                    "Plant": data.Plant,
                    "Location": data.Location,
                    "Quantity": data.SaleQuantity.toString(),
                    "ReservationNo": "",
                    "Type": "",
                    "Status": ""

                }

                this.oModel.create("/ReservationSet", oPayload, {
                    success: function (oData) {

                        var tableData = that.getView().getModel("ProductModel").getProperty("/Product");
                        var bFlag = false;
                        for (var count = 0; count < tableData.length; count++) {

                            if ((tableData[count].Itemcode === data.Itemcode) && (tableData[count].Location === data.Location)) {
                                that.getView().getModel("ProductModel").setProperty("/Product/" + count + "/SaleQuantity", parseInt(tableData[count].SaleQuantity) + 1);
                                that.getView().getModel("ProductModel").setProperty("/Product/" + count + "/NetAmount", parseFloat(parseFloat(tableData[count].UnitPrice).toFixed(2) * parseFloat(tableData[count].SaleQuantity).toFixed(2)).toFixed(2));
                                that.getView().getModel("ProductModel").setProperty("/Product/" + count + "/NetDiscount", parseFloat(parseFloat(tableData[count].Discount).toFixed(2) * parseFloat(tableData[count].SaleQuantity).toFixed(2)).toFixed(2));
                                that.getView().getModel("ProductModel").setProperty("/MaterialCode", "");

                                var netAmount = that.getView().getModel("ProductModel").getProperty("/Product/" + count + "/NetAmount");
                                var netDiscount = that.getView().getModel("ProductModel").getProperty("/Product/" + count + "/NetDiscount");
                                var vatPercent = that.getView().getModel("ProductModel").getProperty("/Product/" + count + "/VatPercent");
                                that.calculateVATAmount(netAmount, netDiscount, vatPercent, count);
                                that.calculateSalesAmount(netAmount, netDiscount, vatPercent, count);
                                bFlag = true;
                            }
                        }
                        if (!bFlag) {
                            var aProducts = that.getView().getModel("ProductModel").getProperty("/Product");
                            aProducts.push(data);
                            that.updateSeq(aProducts);
                            that.checkEnableDisableTile(true);
                            //that.getView().getModel("ProductModel").setProperty("/Product", aProducts);
                            that.getView().getModel("ProductModel").setProperty("/MaterialCode", "");
                            that.backupProdArr.push({
                                "MatCode": data.Itemcode,
                                "LocId": data.Location,
                                "LocName": data.LocationName

                            })
                        }
                    },
                    error: function (oError) {
                        sap.m.MessageToast.show("Error in Reserving the item");
                        sap.m.MessageBox.show(JSON.parse(oError.responseText).error.message.value, {
                            icon: sap.m.MessageBox.Icon.Error,
                            title: "Error",
                            actions: [MessageBox.Action.OK],
                            onClose: function (oAction) {
                                if (oAction === MessageBox.Action.OK) {

                                }
                            }
                        });
                    }
                });
            },
            reservedItemonAdditnSub: function (data, mode) {
                var that = this;
                var oPayload = {
                    "TransactionId": this.getView().byId("tranNumber").getCount(),
                    "ReservedFlag": "I",
                    "Material": data.Itemcode,
                    "Plant": data.Plant,
                    "Location": data.Location,
                    "ReservationNo": "",
                    "Type": "",
                    "Status": "",
                    "Quantity": data.SaleQuantity.toString()

                }
                // if(mode === "add"){
                //     oPayload.Quantity = "1";

                // }
                // else if(mode === "sub"){
                //     oPayload.Quantity = "-1";

                // }else if(mode === "manual"){
                //     oPayload.Quantity = data.SaleQuantity.toString();
                // }

                this.oModel.create("/ReservationSet", oPayload, {
                    success: function (oData) {

                    },
                    error: function (oError) {
                        sap.m.MessageToast.show("Error in Reserving the item");
                    }
                });
            },
            onSearchNumber: function (oEvent) {
                var that = this;
                var searchNumber = oEvent.getParameter("query");
                var aFilters = [];

                aFilters.push(new sap.ui.model.Filter("Mobile", sap.ui.model.FilterOperator.EQ, searchNumber));
                this.oModel.read("/CustomerSet", {
                    filters: aFilters,
                    success: function (oData) {
                        if (oData) {
                            // this.getView().setModel(oModel1, "AddressModel");
                            if(oData.results.length > 0){
                            that.getView().getModel("custAddModel").setData({});
                            that.getView().getModel("custAddModel").setData(oData.results[0]);
                            that.getView().getModel("custAddModel").refresh();
                            that.getView().getModel("ShowSection").setProperty("/selectedMode", "Basic Information");

                            if ((oData.HomeAddressLine1 !== "") || (oData.HomeAddressLine2 !== "")) {
                                sap.ui.getCore().byId("addressRbGrp").setSelectedIndex(0);
                            }
                            else if ((oData.OfficeAddressLine1 !== "") || (oData.OfficeAddressLine2 !== "")) {
                                sap.ui.getCore().byId("addressRbGrp").setSelectedIndex(1);

                            }
                            else if ((oData.OtherAddressLine1 !== "") || (oData.OtherAddressLine2 !== "")) {
                                sap.ui.getCore().byId("addressRbGrp").setSelectedIndex(2);

                            }
                            else {
                                sap.ui.getCore().byId("addressRbGrp").setSelectedIndex(0);
                            }


                        }
                        else{
                        that.showCustomerNotExistMessage();
                        }
                    }
                    

                    },
                    error: function (oError) {
                        that.showCustomerNotExistMessage();
                    }
                });
            },
            showCustomerNotExistMessage: function(){
                        sap.m.MessageBox.show("Customer does not exist. Kindly add it", {
                            icon: sap.m.MessageBox.Icon.Error,
                            title: "Error",
                            actions: [MessageBox.Action.OK],
                            onClose: function (oAction) {
                                if (oAction === MessageBox.Action.OK) {
                                    that.getView().getModel("custAddModel").setData({});
                                    that.getView().getModel("ShowSection").setProperty("/selectedMode", "Basic Information");
                                }
                            }
                        });
            },
            onSelectAddressType: function (oEvent) {
                if (oEvent.getParameter("selectedIndex") === 0) {
                    sap.ui.getCore().byId("homeSection").setVisible(true);
                    sap.ui.getCore().byId("workSection").setVisible(false);
                    sap.ui.getCore().byId("otherSection").setVisible(false);
                }
                if (oEvent.getParameter("selectedIndex") === 1) {
                    sap.ui.getCore().byId("homeSection").setVisible(false);
                    sap.ui.getCore().byId("workSection").setVisible(true);
                    sap.ui.getCore().byId("otherSection").setVisible(false);
                }
                if (oEvent.getParameter("selectedIndex") === 2) {
                    sap.ui.getCore().byId("homeSection").setVisible(false);
                    sap.ui.getCore().byId("workSection").setVisible(false);
                    sap.ui.getCore().byId("otherSection").setVisible(true);
                }
            },
            onCustomerTypeChange: function (oEvent) {
                var that = this;

                if (oEvent.getParameter("selectedItem").getProperty("key") === "TOURIST") {
                    sap.ui.getCore().byId("cardTypelbl").setRequired(true);
                    sap.ui.getCore().byId("issuedBylbl").setRequired(true);
                    sap.ui.getCore().byId("cardNumberlbl").setRequired(true);
                    sap.ui.getCore().byId("nationnalLbl").setRequired(true);
                    sap.ui.getCore().byId("residencelabl").setRequired(true);
                    that.getView().getModel("custAddModel").setProperty("/Code","");
                }
                else {
                    sap.ui.getCore().byId("cardTypelbl").setRequired(false);
                    sap.ui.getCore().byId("issuedBylbl").setRequired(false);
                    sap.ui.getCore().byId("cardNumberlbl").setRequired(false);
                    sap.ui.getCore().byId("nationnalLbl").setRequired(false);
                    sap.ui.getCore().byId("residencelabl").setRequired(false);
                    that.getView().getModel("custAddModel").setProperty("/Code","00971");
                }

            },
            updateSeq: function (products) {

                if (products.length > 0) {

                    for (var count = 0; count < products.length; count++) {
                        products[count].Seq = (count + 1) * 10;
                    }
                }
                this.getView().getModel("ProductModel").setProperty("/Product", products);
                this.getView().getModel("ProductModel").refresh();
                this.setHeaderData();
            },
            onPressSuspend: function (oEvent) {
                var that = this;
                var transId = this.getView().byId("tranNumber").getCount();
                var prodData = this.getView().getModel("ProductModel").getProperty("/Product");
                var apayload = [];
                var oPayload;

                for (var count = 0; count < prodData.length; count++) {
                    apayload.push({
                        "TransactionId": transId,
                        "ReservedFlag": "D",
                        "Material": prodData[count].Itemcode,
                        "Plant": prodData[count].Plant,
                        "Location": prodData[count].Location,
                        "Quantity": prodData[count].SaleQuantity.toString(),
                        "ReservationNo": "",
                        "Type": "",
                        "Status": ""
                    })
                }

                oPayload = {
                    "TransactionId": transId,
                    "ToItems": {
                        "results": apayload
                    }
                }
                this.getView().setBusy(true);
                this.oModel.create("/ReservationHeadSet", oPayload, {
                    success: function (oData) {
                        sap.m.MessageToast.show("Success in Suspend the item");
                        that.onPressPayment(false);
                        //window.location.reload(true);
                    },
                    error: function (oError) {
                        that.getView().setBusy(false);
                        sap.m.MessageToast.show("Error in Suspend the item");
                    }
                });
            },
            checkHomeDelivery: function () {
                var delivery = "";
                var tableData = that.getView().getModel("ProductModel").getProperty("/Product");

                for (var count = 0; count < tableData.length; count++) {

                    if (tableData[count].HomeDelivery) {
                        delivery = "HD";
                        break;
                    }
                }

                return delivery;

            },
            oPayloadTableItems: function () {
                var itemArr = [];
                var tableData = that.getView().getModel("ProductModel").getProperty("/Product");

                for (var count = 0; count < tableData.length; count++) {

                    itemArr.push({
                        "TransactionId": this.getView().byId("tranNumber").getCount().toString(),
                        "TransactionItem": tableData[count].Seq.toString(),
                        "Plant": tableData[count].Plant,
                        "Location": tableData[count].Location,
                        "Material": tableData[count].Itemcode,
                        "Description": tableData[count].Description,
                        "Quantity": tableData[count].SaleQuantity.toString(),
                        "Unit": tableData[count].Unit,
                        "UnitPrice": tableData[count].UnitPrice,
                        "UnitDiscount": tableData[count].Discount.toString().replace("-", ""),
                        "GrossAmount": tableData[count].NetAmount.toString(),
                        "Discount": tableData[count].NetDiscount.toString().replace("-", ""),
                        "NetAmount": parseFloat(parseFloat(tableData[count].NetAmount) + parseFloat(tableData[count].NetDiscount)).toFixed(2),
                        "VatAmount": tableData[count].VatAmount,
                        "SaleAmount": tableData[count].SaleAmount.toString(),
                        "Currency": "AED",
                        "FocItem": "",
                        "SalesmanId": tableData[count].SalesmanId,
                        "SalesmanName": tableData[count].SalesmanName,
                        "VatPercent": tableData[count].VatPercent
                    })
                }

                return itemArr;
            },
            oPayloadTableDiscountItems: function () {
                var itemArr = [];
                var tableData = that.getView().getModel("ProductModel").getProperty("/Product");

                for (var count = 0; count < tableData.length; count++) {
                    var itemDiscount = tableData[count].ToDiscounts.results;
                    for (var count1 = 0; count1 < itemDiscount.length; count1++) {
                        itemArr.push({
                            "TransactionId": this.getView().byId("tranNumber").getCount().toString(),
                            "TransactionItem": tableData[count].Seq.toString(),
                            "ConditionId": itemDiscount[count1].ConditionId,
                            "ConditionType": itemDiscount[count1].ConditionType,
                            "ConditionName": itemDiscount[count1].ConditionName,
                            "ConditionAmount": itemDiscount[count1].ConditionAmount,
                            "Currency": itemDiscount[count1].Currency,
                            "DiscountType": itemDiscount[count1].DiscountType,
                            "ModifierType": itemDiscount[count1].ModifierType,
                            "Remarks": itemDiscount[count1].Remarks,
                            "Authority": itemDiscount[count1].Authority

                        })
                    }

                }

                return itemArr;
            },
            oPayloadTablePayments: function () {
                var itemArr = [];
                itemArr.push({
                    "TransactionId": this.getView().byId("tranNumber").getCount().toString(),
                    "PaymentId": "1",   // sequence of payment
                    "PaymentDate": new Date(),
                    "PaymentMethod": "011", // 011- CASH
                    "PaymentMethodName": "Cash",
                    "Amount": this.getView().byId("saleAmount").getCount().toString(),
                    "Currency": "AED",
                    "CardNumber": "",
                    "AuthorizationCode": "",
                    "CardType": ""

                })

                return itemArr;
            },
            oPayloadSerialNumber: function () {
                var aSerialNumber = []
                var id = 0;
                if (this.serialNumbers.length > 0) {
                    for (var count = 0; count < this.serialNumbers.length; count++) {
                        aSerialNumber.push({
                            "TransactionId": this.getView().byId("tranNumber").getCount().toString(),
                            "TransactionItem": this.serialNumbers[count].seq.toString(),
                            "SerialId": (id + 1).toString(),
                            "SerialNo": this.serialNumbers[count].serialNumber,
                            "VoucherType": "",
                            "VoucherStatus": "",
                            "VoucherAmount": "0.00",
                            "Currency": "",
                            "ExpiryDate": new Date()
                        })
                        id = id + 1;
                    }

                    return aSerialNumber;
                }
                else {

                    return aSerialNumber;
                }

            },
            linkSalesman: function (oEvent) {
                var oComboBox = oEvent.getSource();
                var oSelectedItem = oComboBox.getSelectedItem();

                if (!oSelectedItem) {
                    return;
                }

                var sSalesmanCode = oSelectedItem.getKey();
                var sSalesmanName = oSelectedItem.getText();
                var oContext = oComboBox.getBindingContext("ProductModel");
                if (oContext) {
                    var sPath = oContext.getPath(); // e.g., /Product/0
                    var oModel = oContext.getModel();
                    oModel.setProperty(sPath + "/SalesmanId", sSalesmanCode);
                    oModel.setProperty(sPath + "/SalesmanName", sSalesmanName);

                }
            },
            getTimeInISO8601Format: function () {
                const now = new Date();
                const hours = now.getHours();      // 24-hour format
                const minutes = now.getMinutes();
                const seconds = now.getSeconds();

                return `PT${hours}H${minutes}M${seconds}S`;
            },
            onPressPaymentTest: function () {
                this.onPressPayment(true);
            },
            resolveTimeDifference: function (dateTime) {
                if (dateTime !== undefined && dateTime !== null && dateTime !== "") {
                    var offSet = dateTime.getTimezoneOffset();
                    var offSetVal = dateTime.getTimezoneOffset() / 60;
                    var h = Math.floor(Math.abs(offSetVal));
                    var m = Math.floor((Math.abs(offSetVal) * 60) % 60);
                    dateTime = new Date(dateTime.setHours(h, m, 0, 0));
                    return dateTime;

                }

                return null;

            },
            onPressPayment: function (bflag) {
                
                var mode = "";
                var delDate = ""
                var shippingMode = this.checkHomeDelivery();
                var custData = this.getView().getModel("custAddModel").getData();
                var contactNumber = "";
                custData.Code ? custData.Code : "" + custData.Mobile ? custData.Mobile : ""
                if (custData.Code) {
                    contactNumber = contactNumber + custData.Code;
                }
                if (custData.Mobile) {
                    contactNumber = contactNumber + custData.Mobile;
                }
                if (shippingMode === "HD") {
                    if (this.shippingDate) {
                        delDate = new Date(this.shippingDate);
                    }
                    else {
                        delDate = new Date();
                    }

                }
                else {
                    delDate = new Date();
                }
                if (bflag) {
                    mode = "1"; // completed
                }
                else {
                    mode = "3"; // suspended
                }
                var that = this;
                var oPayload = {
                    "TransactionId": this.getView().byId("tranNumber").getCount().toString(),
                    "TransactionDate": new Date(),//new Date().toISOString().slice(0, 10).replace(/-/g, ''),
                    "ExpiryDate": new Date(),
                    "TransactionTime": this.getTimeInISO8601Format(),//new Date().toTimeString().slice(0, 8).replace(/:/g, ''),
                    "TransactionStatus": mode,
                    "SalesOrder": "",
                    "Flag": "",
                    "Store": that.storeID,
                    "Plant": that.plantID,
                    "CashierId": that.cashierID,
                    "CashierName": that.cashierName,
                    "TransactionType": "1",
                    "ShippingMethod": this.shippingMethod,
                    "GrossAmount": this.getView().byId("gross").getCount().toString(),
                    "Discount": this.getView().byId("discount").getCount().toString().replace("-", ""),
                    "VatAmount": this.getView().byId("vat").getCount().toString(),
                    "SaleAmount": this.getView().byId("saleAmount").getCount().toString(),
                    "Currency": "AED",
                    "OriginalTransactionId": "", // Required for Return Sales
                    "CustomerName": this.getView().byId("customer").getCount(),
                    "ContactNo": contactNumber,
                    "EMail": this.getView().getModel("custAddModel").getData().Email,
                    "Address": this.shippingAddress,
                    "ShippingInstruction": this.shippingInst,
                    "DeliveryDate": this.resolveTimeDifference(delDate),
                    "ToItems": { "results": this.oPayloadTableItems() },
                    "ToDiscounts": { "results": this.oPayloadTableDiscountItems() },
                    "ToPayments": { "results": this.oPayloadPayments(this.aPaymentEntries) },
                    "ToSerials": { "results": this.oPayloadSerialNumber() },
                    "Remarks": this.suspendComments
                    // "ToPayments" : {"results" : this.oPayloadTablePayments()}
                }
                this.getView().setBusy(true);
                this._oDialogPayment.setBusy(true);
                this.oModel.create("/SalesTransactionHeaderSet", oPayload, {
                    success: function (oData) {
                        that.getView().setBusy(false);
                        that._oDialogPayment.setBusy(false);
                        if (oData) {
                         
                        	MessageBox.success("Transaction Posted Successfully.", {
				            onClose: function (sAction) {
					             window.location.reload(true);
				            }});
                        }
                        if (!bflag) {
                            window.location.reload(true);
                        }
                    },
                    error: function (oError) {
                        that.getView().setBusy(false);
                        that._oDialogPayment.setBusy(false);
                        sap.m.MessageToast.show("Error");
                    }
                });

            },
            oPayloadPayments: function (arrPayment) {
                if (arrPayment.length > 0) {
                    return arrPayment.map(item => {
                        return {
                            ...item,
                            Amount: item.Amount.toString()
                        };
                    });
                }
                else {
                    return [];
                }
            },
            onRetrieveTerminal: function (oEvent) {
                this.cashAmount = oEvent.getParameter("value");
                var that = this;
                var aFilters = [];
                aFilters.push(new sap.ui.model.Filter("Store", sap.ui.model.FilterOperator.EQ, this.storeID));
                this.oModel.read("/TerminalsSet", {
                    filters: aFilters,
                    success: function (oData) {
                        that.getView().getModel("ShowPaymentSection").setProperty("/Terminal", []);
                        that.getView().getModel("ShowPaymentSection").setProperty("/Terminal", oData.results);

                    },
                    error: function (oError) {
                        sap.m.MessageBox.show(JSON.parse(oError.responseText).error.message.value, {
                            icon: sap.m.MessageBox.Icon.Error,
                            title: "Error",
                            actions: [MessageBox.Action.OK],
                            onClose: function (oAction) {
                                if (oAction === MessageBox.Action.OK) {

                                }
                            }
                        });
                    }
                });
            },
            onPressTenderCard: function (oEvent) {
                // var terminalID = oEvent.getParameter("srcControl").getAggregation("items")[0].getProperty("text")
                // var machindID = oEvent.getParameter("srcControl").getAggregation("items")[1].getProperty("text");

                var oItem = oEvent.getParameter("listItem") || oEvent.getSource();
                var oVBox = oItem.getContent ? oItem.getContent()[0] : oItem.getAggregation("content")[0];
                var aItems = oVBox.getItems ? oVBox.getItems() : oVBox.getAggregation("items");
                var terminalID = aItems[0]?.getText();
                var machineID = aItems[1]?.getText();
                this.initiateTransaction(terminalID, machineID);
            },
            onPressTenderCash: function (oEvent) {
                var terminalID = oEvent.getParameter("srcControl").getAggregation("items")[0].getText();
                var machindID = oEvent.getParameter("srcControl").getAggregation("items")[1].getText();
                this.initiateTransaction(terminalID, machindID);
            },
            initiateTransaction: function (termID, machID) {
                var that = this;
                sap.ui.core.BusyIndicator.show();
                // BusyDialog.open();
                var oPayload = {
                    "Tid": termID,
                    "Mid": machID,
                    "TransactionType": "pushPaymentSale",
                    "SourceId": this.getView().byId("tranNumber").getCount().toString() + this.sourceIdCounter.toString(),
                    "Amount": this.cashAmount.toString()

                }

                this.oModel.create("/PaymentStartTransactionSet", oPayload, {
                    success: function (oData) {
                        that.sourceIdCounter = that.sourceIdCounter + 1;
                        that.paymentEntSourceCounter = that.paymentEntSourceCounter + 1;
                        sap.ui.getCore().byId("creditAmount").setValue("");
                        that.getView().getModel("ShowPaymentSection").setProperty("/Terminal", []);
                        that.getView().getModel("ShowPaymentSection").refresh();
                        sap.ui.core.BusyIndicator.hide();
                        that.paymentId = that.paymentId + 1;
                        that.getView().setBusy(false);
                        that.aPaymentEntries.push({
                            "TransactionId": that.getView().byId("tranNumber").getCount().toString(),
                            "PaymentId": that.paymentId.toString(),
                            "PaymentDate": new Date(),
                            "Amount": oData.Amount,
                            "Currency": "AED",
                            "PaymentMethod": "",
                            "PaymentMethodName": "Card",
                            "Tid": oData.Tid,
                            "Mid": oData.Mid,
                            "CardType": oData.CardType,
                            "CardLabel": oData.CardLabel,
                            "CardNumber": oData.CardNumber,
                            "AuthorizationCode": oData.AuthorizationCode,
                            "CardReceiptNo": oData.CardReceiptNo,
                            "PaymentType": "CARD",
                            "VoucherNumber": "",
                            "ChangeAmount": "0.00",
                            "SourceId": that.getView().byId("tranNumber").getCount().toString() + that.paymentEntSourceCounter.toString()


                        });

                        var saleAmount = sap.ui.getCore().byId("totalAmountText").getText();
                        var paidAmount = 0;
                        for (var count1 = 0; count1 < that.aPaymentEntries.length; count1++) {

                            paidAmount = parseFloat(parseFloat(that.aPaymentEntries[count1].Amount) + parseFloat(paidAmount)).toFixed(2);

                        }
                        var balanceAmount = parseFloat(parseFloat(saleAmount).toFixed(2) - parseFloat(paidAmount).toFixed(2)).toFixed(2);
                        if (balanceAmount <= 0) {
                            sap.ui.getCore().byId("totaltenderBal").setText(balanceAmount);
                            sap.ui.getCore().byId("totalSaleBalText").setText("0.00");
                            sap.ui.getCore().byId("sbmtTrans").setVisible(true);
                            that.onPressPaymentTest();
                        }
                        else {
                            sap.ui.getCore().byId("totalSaleBalText").setText(parseFloat(Math.abs(balanceAmount)).toFixed(2));
                            sap.ui.getCore().byId("cash").setValue("");
                            sap.ui.getCore().byId("sbmtTrans").setVisible(false);
                        }


                        sap.m.MessageToast.show("Card Payment Successful");

                    },
                    error: function (oError) {
                        that.sourceIdCounter = that.sourceIdCounter + 1;
                        var errMessage = "";
                        sap.ui.core.BusyIndicator.hide();
                        if (JSON.parse(oError.responseText).error.message.value) {
                            errMessage = JSON.parse(oError.responseText).error.message.value;
                        }
                        else {
                            errMessage = "Error During Payment Transaction "
                        }

                        sap.m.MessageBox.show(errMessage, {
                            icon: sap.m.MessageBox.Icon.Error,
                            title: "Error",
                            actions: [MessageBox.Action.OK],
                            onClose: function (oAction) {

                            }
                        });


                    }
                });
            },
            checkEnableDisableTile: function (bflag) {
                this.getView().byId("customergt").setPressEnabled(bflag);
                this.getView().byId("discountgt").setPressEnabled(bflag);
                this.getView().byId("paymentsgt").setPressEnabled(bflag);
                this.getView().byId("suspendgt").setPressEnabled(bflag);

            },
            holdDiscountItem: function (oEvent) {
                var itemCode = oEvent.getParameter("listItem").getBindingContext("ProductModel").getObject().Itemcode;
                var itemDesc = oEvent.getParameter("listItem").getBindingContext("ProductModel").getObject().Description
                this.getView().getModel("DiscountValue").setProperty("/ItemCode", itemCode);
                this.getView().getModel("DiscountValue").setProperty("/ItemDesc", itemDesc);
                this.getView().getModel("ShowDiscountSection").setProperty("/selectedMode", "Discounts Condition");
            },
            selectSuspendReason: function (oEvent) {
                this.suspendComments = oEvent.getParameter("listItem").getBindingContext().getObject().Reason;
                this.onPressSuspend();
            },

            holdDiscountCondition: function (oEvent) {
                var conditionType = oEvent.getParameter("listItem").getBindingContext().getObject().ConditionType;
                var conditionName = oEvent.getParameter("listItem").getBindingContext().getObject().ConditionName;
                this.getView().getModel("DiscountValue").setProperty("/ConditionType", conditionType);
                this.getView().getModel("DiscountValue").setProperty("/ConditionName", conditionName);
                this.getView().getModel("ShowDiscountSection").setProperty("/selectedMode", "Reason Type");
            },
            holdReasonType: function (oEvent) {
                var reason = oEvent.getParameter("listItem").getBindingContext().getObject().Reason;
                this.getView().getModel("DiscountValue").setProperty("/Reason", reason);
                this.getView().getModel("ShowDiscountSection").setProperty("/selectedMode", "Authority");
            },
            holdAuthority: function (oEvent) {
                var authority = oEvent.getParameter("listItem").getBindingContext().getObject().Authority;
                this.getView().getModel("DiscountValue").setProperty("/Authority", authority);
                this.getView().getModel("ShowDiscountSection").setProperty("/selectedMode", "Amount");
            },
            holdDiscountAmount: function (oEvent) {
                var discAmount = oEvent.getParameter("value");
                this.getView().getModel("DiscountValue").setProperty("/DiscAmount", discAmount);
                this.addDiscount();
                this.getView().getModel("ShowDiscountSection").setProperty("/selectedMode", "View All Records");
                sap.ui.getCore().byId("discountAmount").setValue("");


            },
            addDiscount: function () {
                var duplicate = false;
                var discountData = this.getView().getModel("DiscountValue").getData();
                if (this.aEntries1.length > 0) {

                    for (var count = 0; count < this.aEntries1.length; count++) {
                        if (this.aEntries1[count].ItemCode === discountData.ItemCode && this.aEntries1[count].Type === discountData.ConditionType) {
                            duplicate = true;
                            break;
                        }
                    }
                }

                if (!duplicate) {
                    if (discountData.ItemCode && discountData.ConditionType) {
                        this.aEntries1.push({
                            ItemCode: discountData.ItemCode,
                            ItemDescription: discountData.ItemDesc,
                            Reason: discountData.Reason,
                            Type: discountData.ConditionType,
                            Amount: discountData.DiscAmount,
                            Authority: discountData.Authority,
                            ConditionName: discountData.ConditionName,
                            DiscountType: "M"

                        });
                    }
                }
                else {
                    MessageBox.error("Same Discount has been already applied. Kindly Delete the existing record to add new Discount");
                }

                var oModel1 = new sap.ui.model.json.JSONModel();
                oModel1.setData({ "entries": this.aEntries1 });
                this.getView().setModel(oModel1, "discountModelTable");

                this.getView().getModel("DiscountValue").setProperty("/ItemCode", "");
                this.getView().getModel("DiscountValue").setProperty("/ItemDesc", "");
                this.getView().getModel("DiscountValue").setProperty("/ConditionType", "");
                this.getView().getModel("DiscountValue").setProperty("/ConditionName", "");
                this.getView().getModel("DiscountValue").setProperty("/DiscAmount", "");
                this.getView().getModel("DiscountValue").setProperty("/Authority", "");
                this.getView().getModel("DiscountValue").setProperty("/Reason", "");
                this.getView().getModel("DiscountValue").refresh();
            },
            onCloseManualDiscount1: function () {
                this._oDialogDiscoun1.close();
            },
            onApplyManualDiscount1: function () {
                var discountTblData = this.getView().getModel("discountModelTable").getProperty("/entries");
                var productTblData = this.getView().getModel("ProductModel").getProperty("/Product");

                for (var count = 0; count < productTblData.length; count++) {

                    for (var count1 = 0; count1 < discountTblData.length; count1++) {
                        if (discountTblData[count1].ItemCode === productTblData[count].Itemcode) {
                            var bflag = false;
                            for (var count2 = 0; count2 < productTblData[count].ToDiscounts.results.length; count2++) {
                                var dataObj = productTblData[count].ToDiscounts.results;
                                if (dataObj[count2].ItemCode === discountTblData[count1].ItemCode && dataObj[count2].ConditionName === discountTblData[count1].ConditionName) {
                                    bflag = true;
                                    break;
                                }

                            }
                            if (!bflag) {
                                productTblData[count].ToDiscounts.results.push({
                                    "ConditionAmount": "-" + discountTblData[count1].Amount,
                                    "ConditionId": this.retrieveConditionId(productTblData[count]),
                                    "ConditionName": discountTblData[count1].ConditionName,
                                    "ConditionType": discountTblData[count1].Type,
                                    "Currency": "AED",
                                    "DiscountType": "M",
                                    "ItemCode": discountTblData[count1].ItemCode,
                                    "ModifierType": "D",
                                    "Remarks": discountTblData[count1].Reason,
                                    "Authority": discountTblData[count1].Authority

                                })
                                this.updateProductTable(count, productTblData[count], discountTblData[count1]);
                            }
                        }
                    }
                }
                this.onCloseManualDiscount1();

            },
            onDeleteManualDiscount1: function (oEvent) {

                var bflag = false;
                var oModel = this.getView().getModel("discountModelTable"); // Get the JSON model
                var aEntries = oModel.getProperty("/entries"); // Get the array from the model
                var oItem = oEvent.getParameter("listItem");
                var oContext = oItem.getBindingContext("discountModelTable");
                var dataObj = oModel.getObject(oContext.sPath);
                var iIndex = oContext.getPath().split("/").pop(); // Extract index
                var matchProdTableIndex = -1;
                var matchDiscTableIndex = -1;
                aEntries.splice(iIndex, 1);
                oModel.refresh();
                var productTblData = this.getView().getModel("ProductModel").getProperty("/Product");
                for (var count = 0; count < productTblData.length; count++) {
                    var discountData = productTblData[count].ToDiscounts.results;
                    for (var count2 = 0; count2 < discountData.length; count2++) {

                        if (dataObj.ItemCode === discountData[count2].ItemCode && dataObj.ConditionName === discountData[count2].ConditionName && dataObj.DiscountType === "M") {
                            bflag = true;
                            matchProdTableIndex = count;
                            matchDiscTableIndex = count2;
                            break;
                        }
                    }
                }
                if (bflag) {
                    this.removeManualDiscount(matchProdTableIndex, productTblData[matchProdTableIndex], dataObj);
                    this.getView().getModel("ProductModel").getProperty("/Product")[matchProdTableIndex].ToDiscounts.results.splice(matchDiscTableIndex, 1);
                }

            },
            checkCashPayment: function () {
                var bFlag = false;
                if (this.aPaymentEntries.length > 0) {
                    for (var count = 0; count < this.aPaymentEntries.length; count++) {

                        if (this.aPaymentEntries[count].PaymentMethodName === "Cash") {
                            bFlag = true;
                            return count;

                        }
                    }
                }

            },
            enableSerialNumber: function (flag) {
                if (flag === "Y") {
                    return true;
                }
                else {
                    return false;
                }
            },
            onCashSubmit: function (oEvent) {

                var cashAmount = sap.ui.getCore().byId("cash").getValue();
                this.paymentEntSourceCounter = this.paymentEntSourceCounter + 1;
                this.paymentId = this.paymentId + 1;
                var bFlag = false;
                var maxcount = "";
                // if (this.aPaymentEntries.length > 0) {
                //     for (var count = 0; count < this.aPaymentEntries.length; count++) {

                //         if (this.aPaymentEntries[count].PaymentMethodName === "Cash") {
                //             bFlag = true;
                //             maxcount = count;
                //             break;

                //         }
                //     }
                // }
                if (cashAmount !== 0 && cashAmount !== "0.00" && cashAmount !== "") {

                    // if (bFlag) {
                    //     this.aPaymentEntries[maxcount].Amount = parseFloat(this.aPaymentEntries[maxcount].Amount) + parseFloat(cashAmount)
                    // }
                    // else {
                        this.aPaymentEntries.push({
                            "TransactionId": this.getView().byId("tranNumber").getCount().toString(),
                            "PaymentId": this.paymentId.toString(),
                            "PaymentDate": new Date(),
                            "Amount": cashAmount.toString(),
                            "Currency": "AED",
                            "PaymentMethod": "011", //Cash( 011), card ("")
                            "PaymentMethodName": "Cash",
                            "Tid": "",
                            "Mid": "",
                            "CardType": "",
                            "CardLabel": "",
                            "CardNumber": "",
                            "AuthorizationCode": "",
                            "CardReceiptNo": "",
                            "PaymentType": "CASH",
                            "VoucherNumber": "",
                            "SourceId": "",
                            "ChangeAmount": "0.00"


                        });
                    //}

                    var saleAmount = sap.ui.getCore().byId("totalAmountText").getText();
                    var paidAmount = 0;
                    for (var count1 = 0; count1 < this.aPaymentEntries.length; count1++) {

                        paidAmount = parseFloat(parseFloat(this.aPaymentEntries[count1].Amount) + parseFloat(paidAmount)).toFixed(2);

                    }
                    var balanceAmount = parseFloat(parseFloat(saleAmount).toFixed(2) - parseFloat(paidAmount).toFixed(2)).toFixed(2);
                    if (balanceAmount <= 0) {
                        sap.ui.getCore().byId("totaltenderBal").setText(balanceAmount);
                        sap.ui.getCore().byId("totalSaleBalText").setText("0.00");
                        sap.ui.getCore().byId("sbmtTrans").setVisible(true);
                        this.aPaymentEntries.forEach(function (entry) {
                            if (entry.PaymentType === "CASH") {
                                entry.ChangeAmount = balanceAmount.toString();
                            }
                        });
                        oEvent.getSource().setEnabled(false);
                        sap.m.MessageToast.show("Cash Payment Successful");
                        that.onPressPaymentTest();
                    }
                    else {
                        sap.ui.getCore().byId("totalSaleBalText").setText(parseFloat(Math.abs(balanceAmount)).toFixed(2));
                        sap.ui.getCore().byId("cash").setValue("");
                        sap.ui.getCore().byId("sbmtTrans").setVisible(false);
                        sap.m.MessageToast.show("Cash Payment Successful");
                    }



                    //var tenderChangeAmount = this.getView().byId("totaltenderBal").getValue();

                }
            },
            onAddSerialNumber: function (oEvent) {

                var selIndex = oEvent.getSource().getId().split("--")[2].split("-")[1];
                var selIndexData = this.getView().getModel("ProductModel").getObject("/Product/" + selIndex);
                this.getActualQty = parseInt(selIndexData.SaleQuantity);
                this.serialItemCode = selIndexData.Itemcode;
                this.serialTransItem = selIndexData.Seq;
                this._addSerialNumberDialog = null;
                this._addSerialNumberDialog = sap.ui.xmlfragment(
                    "com.eros.salesprocess.fragment.addSerialNumber",
                    this
                );

                var aExistingSerials = this.serialNumbers.filter(function (item) {
                    return item.itemCode === that.serialItemCode;
                });
                var aRows = [];
                if (aExistingSerials.length > 0) {
                    // Use saved serials
                    if (aExistingSerials.length === this.getActualQty) {
                        aRows = aExistingSerials.map(item => ({
                            serialNumber: item.serialNumber
                        }));
                    }
                    else if (aExistingSerials.length < this.getActualQty) {
                        const diff = this.getActualQty - aExistingSerials.length;
                        for (let i = 0; i < diff; i++) {
                            aExistingSerials.push({ itemCode: aExistingSerials[0].itemCode, serialNumber: '' });
                        }
                        aRows = aExistingSerials.map(item => ({
                            serialNumber: item.serialNumber
                        }));
                    }
                    else if (aExistingSerials.length > this.getActualQty) {

                        aExistingSerials.splice(this.getActualQty, aExistingSerials.length - this.getActualQty);
                        aRows = aExistingSerials.map(item => ({
                            serialNumber: item.serialNumber
                        }));
                    }
                    // else{
                    //     for (var i = 0; i < this.getActualQty; i++) {
                    //     aRows.push({ serialNumber: "" });
                    //     }
                    //     }
                    // aRows.splice(aExistingSerials.length - this.getActualQty );
                } else {
                    // Create empty rows for quantity
                    for (var i = 0; i < this.getActualQty; i++) {
                        aRows.push({ serialNumber: "" });
                    }
                }


                var oSerialModel = new sap.ui.model.json.JSONModel({
                    serials: aRows
                });

                sap.ui.getCore().byId("idSerNumber").setModel(oSerialModel, "serialModel");
                // if (filteredSerials.length > 0) {
                //     for (var i = 0; i < filteredSerials.length; i++) {
                //             oTable[i].getAggregation("cells")[0].setProperty("value", filteredSerials[i].serialNumber);

                //     }
                // }
                this._addSerialNumberDialog.open();
            },
            handleAddWorkOrder: function (tableId) {

                var columnListItemNewLine = new sap.m.ColumnListItem({
                    type: sap.m.ListType.Inactive,
                    cells: [
                        // add created controls to item
                        new sap.m.Input({
                            value: ""

                        })

                    ]
                });
                sap.ui.getCore().byId(tableId).addItem(columnListItemNewLine);

            },
            onPressCancelButton: function () {
                if (this._addSerialNumberDialog) {
                    this._addSerialNumberDialog.destroy(true);
                    this._addSerialNumberDialog = null;
                }
            },
            onSaveSerialNumber: function () {
                var that = this;
                var bflag = false;
                var oTable = sap.ui.getCore().byId("idSerNumber").getItems();

                this.serialNumbers = this.serialNumbers.filter(function (item) {
                    return item.itemCode !== that.serialItemCode;
                });

                for (var i = 0; i < oTable.length; i++) {

                    if (oTable[i].getAggregation("cells")[0].getProperty("value") !== "") {
                        this.serialNumbers.push({
                            "itemCode": this.serialItemCode,
                            "serialNumber": oTable[i].getAggregation("cells")[0].getProperty("value"),
                            "seq": this.serialTransItem
                        });
                    }
                    else {
                        bflag = true;
                        MessageBox.error("Kindly add " + oTable.length + " serial number or this selected item or adjust the quantity");
                        break;
                    }
                }

                if (!bflag) {
                    this.onPressCancelButton();
                }
            },
            onProductRowPress: function (oEvent) {
                var that = this;
                var selIndexData = oEvent.getParameter("listItem").getBindingContext("ProductModel").getObject();
                var oItemDetailModel = new sap.ui.model.json.JSONModel({
                    "Location": selIndexData.LocationName,
                    "UnitDiscount": selIndexData.Discount,
                    "GrossDiscount": selIndexData.NetDiscount,
                    "VatAmount": selIndexData.VatAmount,
                    "VatPercent": selIndexData.VatPercent

                });

                if (!that._oDialogItemDetails) {
                    Fragment.load({
                        name: "com.eros.salesprocess.fragment.itemDetail",
                        controller: that
                    }).then(function (oFragment) {
                        that._oDialogItemDetails = oFragment;
                        that.getView().addDependent(that._oDialogItemDetails);
                        sap.ui.getCore().setModel(oItemDetailModel, "itemDataModel");
                        that._oDialogItemDetails.setModel(oItemDetailModel, "itemDataModel");
                        that._oDialogItemDetails.open();
                    }.bind(that));
                } else {
                    that._oDialogItemDetails.setModel(oItemDetailModel, "itemDataModel");
                    sap.ui.getCore().setModel(oItemDetailModel, "itemDataModel");
                    that._oDialogItemDetails.open();
                }
            },
            onCloseItemDetail: function () {
                that._oDialogItemDetails.close();
            },
            fnLiveChangeCmntTxtArea: function (oEvent) {

                if (oEvent.getSource().getValue().length > 0) {
                    this.suspendComments = oEvent.getSource().getValue();
                    sap.ui.getCore().byId("commentsSubm").setEnabled(true);
                }
                else {
                    sap.ui.getCore().byId("commentsSubm").setEnabled(false);
                }
            },
            fnCloseComments: function () {
                that._oDialogSuspComments.close();
            },
            fnSubmitComments: function () {
                this.onPressSuspend();
            },
            openPressSuspendComments: function () {

                if (!that._oDialogSuspComments) {
                    Fragment.load({
                        name: "com.eros.salesprocess.fragment.comments",
                        controller: that
                    }).then(function (oFragment) {
                        that._oDialogSuspComments = oFragment;
                        that.getView().addDependent(that._oDialogSuspComments);
                        that._oDialogSuspComments.open();
                    }.bind(that));
                } else {
                    that._oDialogSuspComments.open();
                }
            },
            onSelectCardType: function (oEvent) {
                var oSelectedItem = oEvent.getParameter("listItem").getBindingContext().getObject();
                this.selectedCardData = oSelectedItem;
                this.selectedCardType = oSelectedItem.CardType;
                this.selectedCardPayMethodName = oSelectedItem.PaymentMethodName;
                this.selectedCardPayMethod = oSelectedItem.PaymentMethod;

                this._oDialogCardType = null;
                if (!this._oDialogCardType) {
                    this._oDialogCardType = new sap.m.Dialog({
                        title: this.selectedCardType,
                        content: [],
                        beginButton: new sap.m.Button({
                            text: "Submit",
                            class: "cstmBtn",
                            press: this.onSubmitCardType.bind(this)
                        }),
                        endButton: new sap.m.Button({
                            text: "Cancel",
                            class: "cstmBtn",
                            press: function () {
                                this._oDialogCardType.close();
                            }.bind(this)
                        })
                    });
                    this._oAmountCardInput = new sap.m.Input({
                        placeholder: "Enter Amount",
                        type: "Number",
                        width: "60%"
                    }).addStyleClass("sapUiSmallMarginBegin  sapUiSmallMarginTop sapUiSmallMarginBottom inputStyle");

                    this._oSelectCardLabel = new sap.m.Input({
                        placeholder: "Enter Card Label",
                        width: "60%"
                    }).addStyleClass("sapUiSmallMarginBegin  sapUiTinyMarginTop sapUiSmallMarginBottom inputStyle");

                    this._oSelectCardApproval = new sap.m.Input({
                        placeholder: "Enter Approval Code",
                        width: "60%"
                    }).addStyleClass("sapUiSmallMarginBegin  sapUiTinyMarginTop sapUiSmallMarginBottom inputStyle");

                    this._oSelectCardReciept = new sap.m.Input({
                        placeholder: "Enter Card Reciept Number",
                        width: "60%"
                    }).addStyleClass("sapUiSmallMarginBegin  sapUiTinyMarginTop sapUiSmallMarginBottom inputStyle");

                    this._oDialogCardType.addContent(this._oAmountCardInput);
                    this._oDialogCardType.addContent(this._oSelectCardLabel);
                    this._oDialogCardType.addContent(this._oSelectCardApproval);
                    this._oDialogCardType.addContent(this._oSelectCardReciept);
                    this.getView().addDependent(this._oDialogCardType);
                }

                // Clear previous input
                this._oAmountCardInput.setValue("");
                this._oSelectCardLabel.setValue("");
                this._oSelectCardApproval.setValue("");
                this._oSelectCardReciept.setValue("");

                this._oDialogCardType.open();
                // sap.ui.getCore().byId("manCardAmount").setValue("");
                // sap.ui.getCore().byId("manCardNumber").setValue("");
                // sap.ui.getCore().byId("manCardApproveCode").setValue("");
                // sap.ui.getCore().byId("manCardReciept").setValue("");
            },
            onSubmitCardType: function () {
                var that = this;
                var sAmount = that._oAmountCardInput.getValue();
                var sCardLabel = that._oSelectCardLabel.getValue();
                var sCardApproval = that._oSelectCardApproval.getValue();
                var sCardReciept = that._oSelectCardReciept.getValue();
                that.paymentEntSourceCounter = that.paymentEntSourceCounter + 1;
                that.paymentId = that.paymentId + 1;

                if (!sAmount) {
                    sap.m.MessageToast.show("Please enter an amount");
                    return;
                }
                if (!sCardLabel) {
                    sap.m.MessageToast.show("Please enter Card Label");
                    return;
                }
                if (!sCardApproval) {
                    sap.m.MessageToast.show("Please enter Card Approval Code");
                    return;
                }
                if (!sCardReciept) {
                    sap.m.MessageToast.show("Please enter Card Reciept Number");
                    return;
                }

                that.aPaymentEntries.push({
                    "TransactionId": that.getView().byId("tranNumber").getCount().toString(),
                    "PaymentId": that.paymentId.toString(),
                    "PaymentDate": new Date(),
                    "Amount": sAmount.toString(),
                    "Currency": "AED",
                    "PaymentMethod": that.selectedCardPayMethod,
                    "PaymentMethodName": that.selectedCardPayMethodName,
                    "Tid": "",
                    "Mid": "",
                    "CardType": "",
                    "CardLabel": "",
                    "CardNumber": "",
                    "AuthorizationCode": "",
                    "CardReceiptNo": "",
                    "PaymentType": "CARD",
                    "VoucherNumber": "",
                    "SourceId": "",
                    "ChangeAmount": "0.00"


                });

                var saleAmount = sap.ui.getCore().byId("totalAmountText").getText();
                var paidAmount = 0;
                for (var count1 = 0; count1 < this.aPaymentEntries.length; count1++) {

                    paidAmount = parseFloat(parseFloat(this.aPaymentEntries[count1].Amount) + parseFloat(paidAmount)).toFixed(2);

                }
                var balanceAmount = parseFloat(parseFloat(saleAmount).toFixed(2) - parseFloat(paidAmount).toFixed(2)).toFixed(2);
                if (balanceAmount <= 0) {
                    sap.ui.getCore().byId("totaltenderBal").setText(balanceAmount);
                    sap.ui.getCore().byId("totalSaleBalText").setText("0.00");
                    sap.ui.getCore().byId("sbmtTrans").setVisible(true);
                    sap.m.MessageToast.show("Manual Card Payment Successful");
                    that.onPressPaymentTest();
                }
                else {
                    sap.ui.getCore().byId("totalSaleBalText").setText(parseFloat(Math.abs(balanceAmount)).toFixed(2));
                    sap.ui.getCore().byId("cash").setValue("");
                    sap.ui.getCore().byId("sbmtTrans").setVisible(false);
                    sap.m.MessageToast.show("Manual Card Payment Successful");
                }
                this._oDialogCardType.close();

            },
            onSelectNonGV: function (oEvent) {
                var oSelectedItem = oEvent.getParameter("listItem").getBindingContext().getObject();
                this._oSelectedReason = oSelectedItem; // Store the clicked item globally
                this.nonGVPaymentMethod = oSelectedItem.PaymentMethod;
                this.nonGVPaymentMethodName = oSelectedItem.PaymentMethodName;

                // if (oSelectedItem.selected) {
                //     // Already selected, optionally show message
                //     MessageToast.show("This item is already selected.");
                //     return;
                // }

                // // Mark item as selected
                // oSelectedItem.selected = true;

                // var oInput = new sap.m.Input({
                //     placeholder: "Enter Amount",
                //     type: "Number",
                //     width:"60%"
                // }).addStyleClass("sapUiSmallMarginBegin  sapUiSmallMarginTop sapUiSmallMarginBottom");
                this._oDialogNonGV = null;
                if (!this._oDialogNonGV) {
                    this._oDialogNonGV = new sap.m.Dialog({
                        title: this.nonGVPaymentMethodName,
                        content: [],
                        beginButton: new sap.m.Button({
                            text: "Submit",
                            class: "cstmBtn",
                            press: this.onSubmitAmount.bind(this)
                        }),
                        endButton: new sap.m.Button({
                            text: "Cancel",
                            class: "cstmBtn",
                            press: function () {
                                this._oDialogNonGV.close();
                            }.bind(this)
                        })
                    });
                    this._oAmountInput = new sap.m.Input({
                        placeholder: "Enter Amount",
                        type: "Number",
                        width: "60%"
                    }).addStyleClass("sapUiSmallMarginBegin  sapUiSmallMarginTop sapUiSmallMarginBottom inputStyle");

                    this._oVoucherNumber = new sap.m.TextArea({
                        placeholder: "Enter Voucher Number",
                        type: "Number",
                        width: "60%"
                    }).addStyleClass("sapUiSmallMarginBegin  sapUiTinyMarginTop sapUiSmallMarginBottom inputStyle");

                    this._oDialogNonGV.addContent(this._oAmountInput);
                    this._oDialogNonGV.addContent(this._oVoucherNumber);
                    this.getView().addDependent(this._oDialogNonGV);
                }

                // Clear previous input
                this._oAmountInput.setValue("");
                this._oVoucherNumber.setValue("");

                this._oDialogNonGV.open();
            },
            onSubmitAmount: function () {
                var that = this;
                var sAmount = that._oAmountInput.getValue();
                var sVoucherNumber = that._oVoucherNumber.getValue();
                that.paymentId = that.paymentId + 1;
                that.paymentEntSourceCounter = that.paymentEntSourceCounter + 1;

                if (!sAmount) {
                    sap.m.MessageToast.show("Please enter an amount");
                    return;
                }
                if (!sVoucherNumber) {
                    sap.m.MessageToast.show("Please enter Voucher Number");
                    return;
                }

                that.aPaymentEntries.push({
                    "TransactionId": that.getView().byId("tranNumber").getCount().toString(),
                    "PaymentId": that.paymentId.toString(),
                    "PaymentDate": new Date(),
                    "Amount": sAmount.toString(),
                    "Currency": "AED",
                    "PaymentMethod": that.nonGVPaymentMethod,
                    "PaymentMethodName": that.nonGVPaymentMethodName,
                    "Tid": "",
                    "Mid": "",
                    "CardType": "",
                    "CardLabel": "",
                    "CardNumber": "",
                    "AuthorizationCode": "",
                    "CardReceiptNo": "",
                    "PaymentType": "NEGV",
                    "VoucherNumber": sVoucherNumber,
                    "SourceId": "",
                    "ChangeAmount": "0.00"


                });

                var saleAmount = sap.ui.getCore().byId("totalAmountText").getText();
                var paidAmount = 0;
                for (var count1 = 0; count1 < this.aPaymentEntries.length; count1++) {

                    paidAmount = parseFloat(parseFloat(this.aPaymentEntries[count1].Amount) + parseFloat(paidAmount)).toFixed(2);

                }
                var balanceAmount = parseFloat(parseFloat(saleAmount).toFixed(2) - parseFloat(paidAmount).toFixed(2)).toFixed(2);
                if (balanceAmount <= 0) {
                    sap.ui.getCore().byId("totaltenderBal").setText(balanceAmount);
                    sap.ui.getCore().byId("totalSaleBalText").setText("0.00");
                    sap.ui.getCore().byId("sbmtTrans").setVisible(true);
                    sap.m.MessageToast.show("Non EGV Payment Successful");
                    that.onPressPaymentTest();
                }
                else {
                    sap.ui.getCore().byId("totalSaleBalText").setText(parseFloat(Math.abs(balanceAmount)).toFixed(2));
                    sap.ui.getCore().byId("cash").setValue("");
                    sap.ui.getCore().byId("sbmtTrans").setVisible(false);
                    sap.m.MessageToast.show("Non EGV Payment Successful");
                }
                this._oDialogNonGV.close();
            },
            onSubmitNonGV: function () {
                var oMultiInput = sap.ui.getCore().byId("multiInput");
                var aTokens = oMultiInput.getTokens();
                var fTotalAmount = 0;

                aTokens.forEach(function (oToken) {
                    var sTokenText = oToken.getText(); // Example: "Reason1 - 500"
                    var aParts = sTokenText.split("-");

                    if (aParts.length === 2) {
                        var sAmt = aParts[1].trim(); // Take second part and remove spaces
                        var fAmt = parseFloat(sAmt);

                        if (!isNaN(fAmt)) {
                            fTotalAmount += fAmt;
                        }
                    }
                });

                // Show total in a MessageToast (you can bind it to a Text field also)
                sap.m.MessageToast.show("Total Amount: " + fTotalAmount);
            },
            onScan: function () {
                var that = this;
                BarcodeScanner.scan(
                    function (mResult) {

                        if (!mResult.cancelled) {
                            that.getMaterialDetail(true, mResult.text);
                        }
                    },
                    function (Error) {
                        window.alert("Scanning Failed :" + Error)
                    }
                )

            },
            onScanStockAvailability: function () {
                var that = this;
                BarcodeScanner.scan(
                    function (mResult) {

                        if (!mResult.cancelled) {
                            that.getStockDetail(true, mResult.text);
                        }
                    },
                    function (Error) {
                        window.alert("Scanning Failed :" + Error)
                    }
                )
            },
            onValidateVoucherAdv: function (oEvent) {
                this.btnEvent = oEvent.getSource();
                var advanceReciept = sap.ui.getCore().byId("advPayment").getValue();
                this.onValidateAdvReciept(oEvent, "A", advanceReciept);

            },
            onValidateGiftVoucher: function (oEvent) {
                this.btnEvent = oEvent.getSource();
                var giftVoucher = sap.ui.getCore().byId("giftVoucher").getValue();
                this.onValidateAdvReciept(oEvent, "E", giftVoucher);
            },
            onValidateCreditNote: function (oEvent) {
                this.btnEvent = oEvent.getSource();
                var creditNote = sap.ui.getCore().byId("creditNote").getValue();
                this.onValidateAdvReciept(oEvent, "C", creditNote);
            },
            onValidateAdvReciept: function (oEvent, mode, reciept) {
                var that = this;
                var oModel = new JSONModel();
                this.oModel.read("/RedeemTransactionSet(Transaction='" + reciept + "',RedemptionType='" + mode + "')", {
                    success: function (oData) {


                        if (mode === "E") {
                            oModel.setData({});
                            oModel.setData(oData);
                            that.getView().setModel(oModel, "GiftVoucher");
                            sap.ui.getCore().byId("gvPaymentList").setVisible(true);

                        } else if (mode === "A") {
                            oModel.setData({});
                            oModel.setData(oData);
                            that.getView().setModel(oModel, "AdvancePayment");
                            sap.ui.getCore().byId("advncePaymentList").setVisible(true);

                        } else if (mode === "C") {
                            oModel.setData({});
                            oModel.setData(oData);
                            that.getView().setModel(oModel, "CreditNote");
                            sap.ui.getCore().byId("creditNoteList").setVisible(true);
                        }

                    },
                    error: function (oError) {
                        if (mode === "E") {
                            oModel.setData({});
                            that.getView().setModel(oModel, "GiftVoucher");
                            sap.ui.getCore().byId("gvPaymentList").setVisible(false);

                        } else if (mode === "A") {
                            oModel.setData({});
                            that.getView().setModel(oModel, "AdvancePayment");
                            sap.ui.getCore().byId("advncePaymentList").setVisible(false);

                        } else if (mode === "C") {
                            oModel.setData({});
                            that.getView().setModel(oModel, "CreditNote");
                            sap.ui.getCore().byId("creditNoteList").setVisible(false);
                        }
                        sap.m.MessageBox.show(JSON.parse(oError.responseText).error.message.value, {
                            icon: sap.m.MessageBox.Icon.Error,
                            title: "Error",
                            actions: [MessageBox.Action.OK],
                            onClose: function (oAction) {

                            }
                        });
                    }
                });
            },
            onRedeemGVPayment: function (oEvent) {
                var that = this;
                that.paymentId = that.paymentId + 1;
                var paidAmount = 0;
                for (var count1 = 0; count1 < this.aPaymentEntries.length; count1++) {

                    paidAmount = parseFloat(parseFloat(this.aPaymentEntries[count1].Amount) + parseFloat(paidAmount)).toFixed(2);

                }
                var saleAmount = sap.ui.getCore().byId("totalAmountText").getText();
                var balanceAmount = parseFloat(parseFloat(saleAmount).toFixed(2) - parseFloat(paidAmount).toFixed(2)).toFixed(2);
                MessageBox.confirm("Are you sure you want to redeem the Gift Voucher ?", {
                    icon: MessageBox.Icon.Confirmation,
                    title: "Confirmation",
                    actions: [MessageBox.Action.YES, MessageBox.Action.NO],
                    emphasizedAction: MessageBox.Action.YES,
                    onClose: function (oAction) {
                        if (oAction == "YES") {
                            that.redeemVoucher(that.paymentId, "017", "EROS Gift Voucher", "EGV", balanceAmount, "GiftVoucher");
                        }
                    }
                });



            },
            onRedeemCreditNote: function (oEvent) {
                var that = this;
                that.paymentId = that.paymentId + 1;
                var paidAmount = 0;
                for (var count1 = 0; count1 < this.aPaymentEntries.length; count1++) {

                    paidAmount = parseFloat(parseFloat(this.aPaymentEntries[count1].Amount) + parseFloat(paidAmount)).toFixed(2);

                }
                var saleAmount = sap.ui.getCore().byId("totalAmountText").getText();
                var balanceAmount = parseFloat(parseFloat(saleAmount).toFixed(2) - parseFloat(paidAmount).toFixed(2)).toFixed(2);
                MessageBox.confirm("Are you sure you want to redeem the Credit Voucher ?", {
                    icon: MessageBox.Icon.Confirmation,
                    title: "Confirmation",
                    actions: [MessageBox.Action.YES, MessageBox.Action.NO],
                    emphasizedAction: MessageBox.Action.YES,
                    onClose: function (oAction) {
                        if (oAction == "YES") {
                            that.redeemVoucher(that.paymentId, "030", "Credit Memo", "CREDIT_NOTE", balanceAmount, "CreditNote");
                        }
                    }
                });





            },
            onRedeemAdvPayment: function (oEvent) {
                var that = this;
                that.paymentId = that.paymentId + 1;
                var paidAmount = 0;
                for (var count1 = 0; count1 < this.aPaymentEntries.length; count1++) {

                    paidAmount = parseFloat(parseFloat(this.aPaymentEntries[count1].Amount) + parseFloat(paidAmount)).toFixed(2);

                }
                var saleAmount = sap.ui.getCore().byId("totalAmountText").getText();
                var balanceAmount = parseFloat(parseFloat(saleAmount).toFixed(2) - parseFloat(paidAmount).toFixed(2)).toFixed(2);
                MessageBox.confirm("Are you sure you want to redeem the Advance Payment Voucher ?", {
                    icon: MessageBox.Icon.Confirmation,
                    title: "Confirmation",
                    actions: [MessageBox.Action.YES, MessageBox.Action.NO],
                    emphasizedAction: MessageBox.Action.YES,
                    onClose: function (oAction) {
                        if (oAction == "YES") {
                            that.redeemVoucher(that.paymentId, "030", "On-Account Receipt", "ADVANCE_PAYMENT", balanceAmount, "AdvancePayment");
                        }
                    }
                });





            },
            redeemVoucher: function (paymentId, paymentMethod, paymentMethodName, paymentType1, balanceAmount, model) {
                var that = this;
                var itemData = this.getView().getModel(model).getData();
                var balanceAmt = 0;
                if (itemData.RedemptionType === "E") {
                    balanceAmt = itemData.BalanceAmount;
                }
                else {
                    balanceAmt = balanceAmount;
                }
                var oPayload = {
                    "Transaction": itemData.Transaction,
                    "RedemptionType": itemData.RedemptionType,
                    "ToBeRedeemedAmount": balanceAmt,
                    "Currency": itemData.Currency,
                    "RedeemedAmount": itemData.RedeemedAmount,
                    "BalanceAmount": itemData.BalanceAmount,
                    "TransactionAmount": itemData.TransactionAmount


                }
                if (parseInt(itemData.BalanceAmount) < parseInt(balanceAmt)) {
                    oPayload.ToBeRedeemedAmount = itemData.BalanceAmount;
                }

                this.oModel.create("/RedeemTransactionSet", oPayload, {
                    success: function (oData) {
                        if (oData) {
                            that.paymentEntSourceCounter = that.paymentEntSourceCounter + 1;
                            that.aPaymentEntries.push({
                                "TransactionId": that.getView().byId("tranNumber").getCount().toString(),
                                "PaymentId": that.paymentId.toString(),
                                "PaymentDate": new Date(),
                                "Amount": oPayload.ToBeRedeemedAmount.toString(),
                                "Currency": "AED",
                                "PaymentMethod": paymentMethod,
                                "PaymentMethodName": paymentMethodName,
                                "Tid": "",
                                "Mid": "",
                                "CardType": "",
                                "CardLabel": "",
                                "CardNumber": "",
                                "AuthorizationCode": "",
                                "CardReceiptNo": "",
                                "PaymentType": paymentType1,
                                "VoucherNumber": oData.Transaction,
                                "SourceId": "",
                                "ChangeAmount": "0.00"


                            });
                        }

                        if (paymentType1 === "EGV") {
                            that.updateBalanceAmount("Gift Voucher", "GiftVoucher");
                        }
                        if (paymentType1 === "CREDIT_NOTE") {
                            that.updateBalanceAmount("Credit Voucher", "CreditNote");

                        }
                        if (paymentType1 === "ADVANCE_PAYMENT") {
                            that.updateBalanceAmount("Advance Reciept", "AdvancePayment");
                        }
                    },
                    error: function (oError) {
                        this.paymentEntSourceCounter = this.paymentEntSourceCounter + 1;
                        if (JSON.parse(oError.responseText).error.message.value) {
                            errMessage = JSON.parse(oError.responseText).error.message.value;
                        }
                        else {
                            errMessage = "Error During Payment Transaction "
                        }

                        sap.m.MessageBox.show(errMessage, {
                            icon: sap.m.MessageBox.Icon.Error,
                            title: "Error",
                            actions: [MessageBox.Action.OK],
                            onClose: function (oAction) {

                            }
                        });

                    }
                });




            },
            onLiveChange: function (oEvent) {
                var oInput = oEvent.getSource();
  var sRawValue = oInput.getFocusDomRef().value;
  var sSanitized = sRawValue.replace(/[^0-9]/g, ""); // Allow only digits
  oInput.setValue(sSanitized);
            },
            updateBalanceAmount: function (msg, modelName) {
                var saleAmount = sap.ui.getCore().byId("totalAmountText").getText();
                var paidAmount = 0;
                for (var count1 = 0; count1 < this.aPaymentEntries.length; count1++) {

                    paidAmount = parseFloat(parseFloat(this.aPaymentEntries[count1].Amount) + parseFloat(paidAmount)).toFixed(2);

                }
                var balanceAmount = parseFloat(parseFloat(saleAmount).toFixed(2) - parseFloat(paidAmount).toFixed(2)).toFixed(2);
                if (balanceAmount <= 0) {
                    sap.ui.getCore().byId("totaltenderBal").setText(balanceAmount);
                    sap.ui.getCore().byId("totalSaleBalText").setText("0.00");
                    sap.ui.getCore().byId("sbmtTrans").setVisible(true);
                    sap.m.MessageToast.show(msg + " Redeemed Successfully");
                    that.onPressPaymentTest();
                }
                else {
                    sap.ui.getCore().byId("totalSaleBalText").setText(parseFloat(Math.abs(balanceAmount)).toFixed(2));
                    sap.ui.getCore().byId("cash").setValue("");
                    sap.ui.getCore().byId("sbmtTrans").setVisible(false);
                    sap.m.MessageToast.show(msg + " Redeemed Successfully");
                }
                that.getView().getModel(modelName).setData({});
                if (modelName === "GiftVoucher") {
                    sap.ui.getCore().byId("giftVoucher").setValue("");
                    sap.ui.getCore().byId("gvPaymentList").setVisible(false);
                }
                else if (modelName === "CreditNote") {
                    sap.ui.getCore().byId("creditNote").setValue("");
                    sap.ui.getCore().byId("creditNoteList").setVisible(false);

                } else if (modelName === "AdvancePayment") {
                    sap.ui.getCore().byId("advPayment").setValue("");
                    sap.ui.getCore().byId("advncePaymentList").setVisible(false);
                }
            }

        });
    });

