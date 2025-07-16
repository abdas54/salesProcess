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
                this.cashierID = "";
                this.CashierPwd = "";

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
            getMaterialDetail: function (flag, matCode, data) {
                var aFilters = [];

                aFilters.push(new sap.ui.model.Filter("Itemcode", sap.ui.model.FilterOperator.EQ, matCode));
                if (data !== "") {
                    aFilters.push(new sap.ui.model.Filter("Plant", sap.ui.model.FilterOperator.EQ, data.getProperty("Plant")));
                    aFilters.push(new sap.ui.model.Filter("Location", sap.ui.model.FilterOperator.EQ, data.getProperty("Location")));
                }


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
                            that.serialNumbers = that.serialNumbers.filter(function (entry) {
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
            // onDialogClose: function () {
            //     this.getView().byId("page").setVisible(true);
            // },
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
            onDeleteManualPayment: function (oEvent) {
                var oModel = this.getView().getModel("ShowPaymentSection"); // Get the JSON model
                var aEntries = oModel.getProperty("/allEntries"); // Get the array from the model
                var oItem = oEvent.getParameter("listItem");
                var oContext = oItem.getBindingContext("ShowPaymentSection");
                var dataObj = oModel.getObject(oContext.sPath);
                var iIndex = oContext.getPath().split("/").pop();
                aEntries.splice(iIndex, 1);
                //this.aPaymentEntries.splice(iIndex,1);
                var balanceAmount = "";
                if (dataObj.PaymentType === "CASH") {
                    var totSalBal = sap.ui.getCore().byId("totalSaleBalText").getText();
                    balanceAmount = parseFloat(dataObj.Amount) + parseFloat(totSalBal)
                    sap.ui.getCore().byId("totalSaleBalText").setText(parseFloat(balanceAmount).toFixed(2));
                    this.getView().getModel("ShowPaymentSection").setProperty("/allEntries", this.aPaymentEntries)
                    this.getView().getModel("ShowPaymentSection").refresh();
                }
                else if(dataObj.PaymentType === "BOUNZ"){
                    sap.m.MessageBox.INFORMATION("Bounz Payment cannot be deleted");
                }
                else {
                    this.deRedeemVoucher(dataObj);
                }

            },
            deRedeemVoucher: function (dataObj) {
                var balanceAmount = "";
                var that = this;
                var data = {
                    "PaymentType": dataObj.PaymentType,
                    "Amount": dataObj.Amount,
                    "VoucherNumber": dataObj.VoucherNumber
                }
                this.oModel.create("/PaymentMethodsSet", data, {
                    success: function (oData, response) {
                        var totSalBal = sap.ui.getCore().byId("totalSaleBalText").getText();
                        balanceAmount = parseFloat(dataObj.Amount) + parseFloat(totSalBal)
                        sap.ui.getCore().byId("totalSaleBalText").setText(parseFloat(balanceAmount).toFixed(2));
                        that.getView().getModel("ShowPaymentSection").setProperty("/allEntries", that.aPaymentEntries)
                        that.getView().getModel("ShowPaymentSection").refresh();

                    },
                    error: function (oError) {


                    }
                });

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
                    var vatAmount = parseFloat(updatedNetAmount * (productTblData.VatPercent) / 100).toFixed(2);
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
            enableValidateBtn: function (oEvent) {
                if (oEvent.getSource().getId() === "cashId") {
                    this.cashierID = oEvent.getSource().getValue();
                }
                else if (oEvent.getSource().getId() === "casPwd") {
                    this.CashierPwd = oEvent.getSource().getValue();
                }


                if (this.cashierID.length > 0 && this.CashierPwd.length > 0) {
                    sap.ui.getCore().byId("validatebtn").setEnabled(true);
                }
                else {
                    sap.ui.getCore().byId("validatebtn").setEnabled(false);
                }
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
                        if (oItem.SerialFlag === "Y" && !oItem.HomeDelivery) {
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
                var balanceAmount = "";
                var saleAmount = "";
                if (checkHomeDelivery === "HD") {
                    if (custData.shippingDate === undefined || custData.shippingDate === null || custData.ShippingInst === undefined || custData.ShippingInst === null) {
                        homeDelivery = false;
                    }
                }
                if (checkCustomer && checkSerial && discountAmount && homeDelivery && chckSalesman) {
                    var oModel = new sap.ui.model.json.JSONModel({
                        totalAmount: "0.00",
                        paymentOptions: [{
                            option: "Cash",
                            icon: "sap-icon://wallet"
                        }, {
                            option: "Card",
                            icon: "sap-icon://credit-card"
                        }, {
                            option: "CreditNote",
                            icon: "sap-icon://commission-check"
                        }, {
                            option: "Advance Payment",
                            icon: "sap-icon://batch-payments"
                        }, {
                            option: "Gift Voucher",
                            icon: "sap-icon://money-bills"
                        }, {
                            option: "Non-GV",
                            icon: "sap-icon://money-bills"
                        },
                        {
                            option: "Bounze",
                            icon: "sap-icon://chain-link"
                        },
                        {
                            option: "View All Records",
                            icon: "sap-icon://sum"
                        }]

                        // {
                        //     option: "Forex",
                        //     icon : "sap-icon://currency"
                        // }
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

                    if (!that._oDialogPayment) {
                        Fragment.load({
                            name: "com.eros.salesprocess.fragment.payment",
                            controller: that
                        }).then(function (oFragment) {
                            that._oDialogPayment = oFragment;
                            that.getView().addDependent(that._oDialogPayment);
                            that.getView().getModel("ShowPaymentSection").setProperty("/selectedMode", "");
                            sap.ui.getCore().byId("cashSbmtBtn").setEnabled(true);
                            sap.ui.getCore().byId("totalAmountText").setText(that.getView().byId("saleAmount").getCount());
                            saleAmount = that.getView().byId("saleAmount").getCount();
                            for (var count2 = 0; count2 < that.aPaymentEntries.length; count2++) {
                                paidAmount = parseFloat(parseFloat(that.aPaymentEntries[count2].Amount) + parseFloat(paidAmount)).toFixed(2);

                            }
                            balanceAmount = parseFloat(parseFloat(saleAmount).toFixed(2) - parseFloat(paidAmount).toFixed(2)).toFixed(2);
                            sap.ui.getCore().byId("totalSaleBalText").setText(balanceAmount);
                            that._oDialogPayment.open();
                            that._oDialogCashier.close();
                        }.bind(that));
                    } else {
                        that.getView().getModel("ShowPaymentSection").setProperty("/selectedMode", "");
                        sap.ui.getCore().byId("cashSbmtBtn").setEnabled(true);
                        sap.ui.getCore().byId("totalAmountText").setText(that.getView().byId("saleAmount").getCount());
                        saleAmount = that.getView().byId("saleAmount").getCount();
                        for (var count1 = 0; count1 < that.aPaymentEntries.length; count1++) {
                            paidAmount = parseFloat(parseFloat(that.aPaymentEntries[count1].Amount) + parseFloat(paidAmount)).toFixed(2);

                        }
                        balanceAmount = parseFloat(parseFloat(saleAmount).toFixed(2) - parseFloat(paidAmount).toFixed(2)).toFixed(2);
                        sap.ui.getCore().byId("totalSaleBalText").setText(balanceAmount);
                        that._oDialogPayment.open();
                        that._oDialogCashier.close();
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
                    else if (!homeDelivery) {
                        MessageBox.error("Kindly make sure to enter Shipping Instruction and Date for Home Delivery Item");
                    }
                    else if (!chckSalesman) {
                        MessageBox.error("Following Item Codes does not have Salesman :\n" + this.aMissingSalesmanItems.join(", "));
                    }
                }
            },
            checkSalesman: function () {
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
                else {
                    return true;
                }

            },
            onPressDiscount1: function () {
                var oModel = new sap.ui.model.json.JSONModel({

                    DiscountList: [{
                        option: "Item List",
                        icon: "sap-icon://activities"
                    }, {
                        option: "Discounts Condition",
                        icon: "sap-icon://blank-tag-2"
                    }, {
                        option: "Reason Type",
                        icon: "sap-icon://cause"
                    }, {
                        option: "Authority",
                        icon: "sap-icon://employee"
                    }, {
                        option: "Amount",
                        icon: "sap-icon://money-bills"
                    }, {
                        option: "View All Records",
                        icon: "sap-icon://sum"
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
                var sSelectedOption = oEvent.getSource().getProperty("header"); //    oEvent.getSource().getTitle();
                var showSection = new JSONModel();
                showSection.setData({
                    "selectedMode": sSelectedOption
                });
                this.getView().setModel(showSection, "ShowSection");
                //	sap.m.MessageToast.show("Selected: " + sSelectedOption);
            },
            onDiscountSectSelected: function (oEvent) {
                var sSelectedOption = oEvent.getSource().getProperty("header"); //oEvent.getSource().getTitle();
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
                var that = this;
                var sSelectedOption = oEvent.getSource().getProperty("header"); // oEvent.getSource().getTitle();
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
                if (sSelectedOption === "View All Records") {
                    this.getView().getModel("ShowPaymentSection").setProperty("/allEntries", this.aPaymentEntries)
                }
                if (sSelectedOption === "Bounze") {
                    that.bcode = this.getView().getModel("custAddModel").getData().Code;
                    that.bphnNumber = this.getView().getModel("custAddModel").getData().Mobile;
                    sap.ui.getCore().byId("bounzeCustNumber").setValue(that.bcode + " - " + that.bphnNumber);
                    sap.ui.getCore().byId("registerBounz").setEnabled(false);
                    sap.ui.getCore().byId("bounzeDetails").setVisible(false);
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
                        option: "Basic Information",
                        icon: "sap-icon://add-contact"
                    }, {
                        option: "Customer Address",
                        icon: "sap-icon://database"
                    }, {
                        option: "Shipping Instruction",
                        icon: "sap-icon://shipping-status"
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
                if (!custData.Mobile || custData.Mobile.trim() === "") {
                    errorMessage += "Mobile Number is required.\n";
                }

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


                if (birthDate) {
                    data.BirthDate = new Date(this.resolveTimeDifference(new Date(birthDate)));
                }
                else {
                    data.BirthDate = null;
                }

                data.IdentityExpiry = null;

                this.oModel.create("/CustomerSet", data, {
                    success: function (oData, response) {
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
                this.getView().setBusy(false);
                var event = oEvent.getSource();
                var oTable = this.getView().byId("idProductsTable");
                var selIndex = oEvent.getSource().getId().split("--")[2].split("-")[1];
                var selIndexData = this.getView().getModel("ProductModel").getObject("/Product/" + selIndex);
                var balanceStock = selIndexData.Balancestock;
                var qtyValue = oEvent.getSource().getEventingParent().getItems()[1].getValue();
                var iValue = parseInt(qtyValue, 10) || 0;
                if (iValue > 0) {
                    oEvent.getSource().getEventingParent().getItems()[1].setValue(iValue - 1);
                    var itemQty = oEvent.getSource().getEventingParent().getItems()[1].getValue();
                    if (parseInt(itemQty) !== 0) {

                        var that = this;
                        var oPayload = {
                            "TransactionId": this.getView().byId("tranNumber").getCount(),
                            "ReservedFlag": "I",
                            "Material": selIndexData.Itemcode,
                            "Plant": selIndexData.Plant,
                            "Location": selIndexData.Location,
                            "ReservationNo": "",
                            "Type": "",
                            "Status": "",
                            "Quantity": selIndexData.SaleQuantity.toString()

                        }
                        this.oModel.create("/ReservationSet", oPayload, {
                            success: function (oData) {
                                that.getView().getModel("ProductModel").getObject("/Product/" + selIndex).NetAmount = parseFloat(parseFloat(selIndexData.UnitPrice).toFixed(2) * parseFloat(itemQty).toFixed(2)).toFixed(2);
                                that.getView().getModel("ProductModel").getObject("/Product/" + selIndex).NetDiscount = parseFloat(parseFloat(selIndexData.Discount).toFixed(2) * parseFloat(itemQty).toFixed(2)).toFixed(2);
                                var netAmount = that.getView().getModel("ProductModel").getObject("/Product/" + selIndex).NetAmount;
                                var netDiscount = that.getView().getModel("ProductModel").getObject("/Product/" + selIndex).NetDiscount
                                var vatPercent = that.getView().getModel("ProductModel").getObject("/Product/" + selIndex).VatPercent
                                // this.getView().getModel("ProductModel").getObject("/Product/" + selIndex).NetAmount= parseFloat(parseFloat(netAmount) + parseFloat(netDiscount)).toFixed(2);
                                that.calculateVATAmount(netAmount, netDiscount, vatPercent, selIndex);
                                that.calculateSalesAmount(netAmount, netDiscount, vatPercent, selIndex);
                                that.getView().setBusy(false);
                            },
                            error: function (oError) {
                                that.getView().setBusy(false);
                                sap.m.MessageBox.show(JSON.parse(oError.responseText).error.message.value, {
                                    icon: sap.m.MessageBox.Icon.Error,
                                    title: "Error",
                                    actions: [MessageBox.Action.OK],
                                    onClose: function (oAction) {
                                        if (oAction === MessageBox.Action.OK) {
                                            event.getEventingParent().getItems()[1].setValue(1);
                                            event.getEventingParent().getItems()[1].getSource().fireChange();
                                        }
                                    }
                                });
                            }
                        });




                    } else {
                        sap.m.MessageBox.confirm("Do you want to delete the Item, press Ok to Continue or Cancel",
                            {
                                actions: ["OK", "CANCEL"],
                                onClose: function (sAction) {
                                    if (sAction === "OK") {
                                        var oItemToDelete = oTable.getItems()[selIndex];
                                        oTable.fireDelete({ listItem: oItemToDelete });
                                    }
                                    else {
                                        event.getEventingParent().getItems()[1].setValue(1);
                                        event.getEventingParent().getItems()[1].getSource().fireChange();
                                    }
                                }
                            })
                    }

                }

            },
            onManualChangeQty: function (oEvent) {
                this.getView().setBusy(true);
                var event = oEvent.getSource();
                var oTable = this.getView().byId("idProductsTable");
                var qty = oEvent.getParameter("newValue");
                var selIndex = oEvent.getSource().getParent().getId().split("--")[2].split("-")[1];
                var selIndexData = this.getView().getModel("ProductModel").getObject("/Product/" + selIndex);
                var balanceStock = selIndexData.Balancestock;

                if (!qty) {
                    qty = selIndexData.SaleQuantity.toString();
                }

                if ((qty !== "0")) {


                    var that = this;
                    var oPayload = {
                        "TransactionId": this.getView().byId("tranNumber").getCount(),
                        "ReservedFlag": "I",
                        "Material": selIndexData.Itemcode,
                        "Plant": selIndexData.Plant,
                        "Location": selIndexData.Location,
                        "ReservationNo": "",
                        "Type": "",
                        "Status": "",
                        "Quantity": selIndexData.SaleQuantity.toString()

                    }
                    this.oModel.create("/ReservationSet", oPayload, {
                        success: function (oData) {
                            var qtyValue = qty;
                            var iValue = parseInt(qtyValue, 10) || 0;
                            selIndexData.NetAmount = parseFloat(parseFloat(selIndexData.UnitPrice).toFixed(2) * parseFloat(iValue).toFixed(2)).toFixed(2);
                            selIndexData.NetDiscount = parseFloat(parseFloat(selIndexData.Discount).toFixed(2) * parseFloat(iValue).toFixed(2)).toFixed(2);

                            var netAmount = selIndexData.NetAmount;
                            var netDiscount = selIndexData.NetDiscount
                            var vatPercent = selIndexData.VatPercent
                            // selIndexData.NetAmount= parseFloat(parseFloat(netAmount) + parseFloat(netDiscount)).toFixed(2);
                            that.calculateVATAmount(netAmount, netDiscount, vatPercent, selIndex);
                            that.calculateSalesAmount(netAmount, netDiscount, vatPercent, selIndex);
                            that.getView().setBusy(false);
                        },
                        error: function (oError) {
                            that.getView().setBusy(false);
                            sap.m.MessageBox.show(JSON.parse(oError.responseText).error.message.value, {
                                icon: sap.m.MessageBox.Icon.Error,
                                title: "Error",
                                actions: [MessageBox.Action.OK],
                                onClose: function (oAction) {
                                    if (oAction === MessageBox.Action.OK) {
                                        if (JSON.parse(oError.responseText).error.message.value) {
                                            var resrveQty = parseInt(JSON.parse(oError.responseText).error.message.value.split(":")[1]);
                                            event.setValue(resrveQty);
                                            event.fireChange();
                                        }

                                    }
                                }
                            });
                        }
                    });



                }
                else {
                    sap.m.MessageBox.confirm("Do you want to delete the Item, press Ok to Continue or Cancel",
                        {
                            title: "Confirmation",
                            actions: ["OK", "CANCEL"],
                            onClose: function (sAction) {
                                if (sAction === "OK") {
                                    var oItemToDelete = oTable.getItems()[selIndex];
                                    oTable.fireDelete({ listItem: oItemToDelete });
                                }
                                else {
                                    event.setValue(1);
                                    event.fireChange();
                                }


                            }
                        }
                    );
                }


            },
            onAddition: function (oEvent) {
                this.getView().setBusy(true);
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

                //this.reservedItemonAdditnSub(selIndexData, "add");
                var that = this;
                var oPayload = {
                    "TransactionId": this.getView().byId("tranNumber").getCount(),
                    "ReservedFlag": "I",
                    "Material": selIndexData.Itemcode,
                    "Plant": selIndexData.Plant,
                    "Location": selIndexData.Location,
                    "ReservationNo": "",
                    "Type": "",
                    "Status": "",
                    "Quantity": selIndexData.SaleQuantity.toString()

                }
                this.oModel.create("/ReservationSet", oPayload, {
                    success: function (oData) {
                        that.getView().getModel("ProductModel").getObject("/Product/" + selIndex).NetAmount = parseFloat(parseFloat(selIndexData.UnitPrice).toFixed(2) * parseFloat(itemQty).toFixed(2)).toFixed(2);
                        that.getView().getModel("ProductModel").getObject("/Product/" + selIndex).NetDiscount = parseFloat(parseFloat(selIndexData.Discount).toFixed(2) * parseFloat(itemQty).toFixed(2)).toFixed(2);

                        var netAmount = that.getView().getModel("ProductModel").getObject("/Product/" + selIndex).NetAmount;
                        var netDiscount = that.getView().getModel("ProductModel").getObject("/Product/" + selIndex).NetDiscount
                        var vatPercent = that.getView().getModel("ProductModel").getObject("/Product/" + selIndex).VatPercent
                        // this.getView().getModel("ProductModel").getObject("/Product/" + selIndex).NetAmount= parseFloat(parseFloat(netAmount) + parseFloat(netDiscount)).toFixed(2);
                        that.calculateVATAmount(netAmount, netDiscount, vatPercent, selIndex);
                        that.calculateSalesAmount(netAmount, netDiscount, vatPercent, selIndex);
                        that.getView().setBusy(false);
                    },
                    error: function (oError) {
                        that.getView().setBusy(false);
                        sap.m.MessageBox.show(JSON.parse(oError.responseText).error.message.value, {
                            icon: sap.m.MessageBox.Icon.Error,
                            title: "Error",
                            actions: [MessageBox.Action.OK],
                            onClose: function (oAction) {
                                if (oAction === MessageBox.Action.OK) {
                                    that.oControl.setValue(qtyValue);
                                    that.oControl.getSource().fireChange();
                                }
                            }
                        });
                    }
                });




            },
            calculateSalesAmount: function (netAmount, netDiscount, vatPercent, selIndex) {

                var netPrice = (parseFloat(netAmount) + parseFloat(netDiscount)).toFixed(2);
                var vatAmount = parseFloat(netPrice * vatPercent / 100).toFixed(2);
                this.getView().getModel("ProductModel").getObject("/Product/" + selIndex).SaleAmount = parseFloat(vatAmount) + parseFloat(netPrice);
                this.getView().getModel("ProductModel").refresh();
            },
            calculateVATAmount: function (netAmount, netDiscount, vatPercent, selIndex) {
                var netPrice = (parseFloat(netAmount) + parseFloat(netDiscount)).toFixed(2);
                var vatAmount = parseFloat(netPrice * vatPercent / 100).toFixed(2);
                this.getView().getModel("ProductModel").getObject("/Product/" + selIndex).VatAmount = vatAmount;
                this.getView().getModel("ProductModel").refresh();

            },
            formatVatAmount: function (unitPrice, unitDiscount, vatPercent, vatAmount, seq) {

                if (parseFloat(vatAmount).toFixed(2) === "0.00") {
                    var netPrice = (parseFloat(unitPrice) + parseFloat(unitDiscount)).toFixed(2);
                    var vatAmount = parseFloat(netPrice * vatPercent / 100).toFixed(2);
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
                    var netPrice = (parseFloat(unitPrice) + parseFloat(unitDiscount)).toFixed(2);
                    var vatAmount = parseFloat(netPrice * vatPercent / 100).toFixed(2);
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
                        name: "com.eros.salesprocess.fragment.signaturePad",
                        controller: this,
                    }).then(function (oValueHelpDialog) {
                        oView.addDependent(oValueHelpDialog);
                        return oValueHelpDialog;
                    });
                }

                this._pAddRecordDialog.then(
                    function (oValueHelpDialog) {
                        //    that.onClear();
                        oValueHelpDialog.open();
                    }.bind(that)
                );
            },
            onClear: function () {
                sap.ui.core.Fragment.byId(this.getView().getId(), "idSignaturePad").clear();
                sap.ui.core.Fragment.byId(this.getView().getId(), "idSignaturePadCash").clear();
                // sap.ui.core.Fragment.byId(this.getView().getId(), "idName").setValue("");
                // sap.ui.core.Fragment.byId(this.getView().getId(), "idStaff").setValue("");
                // sap.ui.core.Fragment.byId(this.getView().getId(), "idComments").setValue("");
            },
            onDialogClose: function () {
                //this.onClear();
                this._pAddRecordDialog.then(
                    function (oValueHelpDialog) {
                        oValueHelpDialog.close();
                    }.bind(this)
                );



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
                                if (sAction === "OK") {
                                    var oItemToDelete = oTable.getItems()[that.sPathOpenAllLocation.split("/Product/")[1]];
                                    oTable.fireDelete({ listItem: oItemToDelete });
                                }
                                else {
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
            onPressCancelHomeDelivery: function () {
                that._oHomeDelMat.close();
                that.switch.setState(false);
            },
            onSuggest: function (oEvent) {
                var that = this;
                this.openMessageBox = false;
                var sValue = "";
                that._lastSuggestTimestamp = Date.now();
                var requestTimestamp = that._lastSuggestTimestamp;

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
                    var oSuggestionModel = that.getView().getModel("suggestionModel");
                    if (!oSuggestionModel) {
                        oSuggestionModel = new sap.ui.model.json.JSONModel({ suggestions: [] });
                        that.getView().setModel(oSuggestionModel, "suggestionModel");
                    } else {
                        oSuggestionModel.setProperty("/suggestions", []);
                    }
                    var aFilters = [new sap.ui.model.Filter("Itemcode", sap.ui.model.FilterOperator.Contains, sValue)];
                    this.oModel.read("/MaterialSet", {
                        urlParameters: {
                            "$expand": "ToDiscounts"
                        },
                        filters: aFilters,
                        success: function (oData) {
                            if (oData.results.length > 0) {
                                if (requestTimestamp !== that._lastSuggestTimestamp) {
                                    return;
                                }
                                else {
                                    oSuggestionModel.setProperty("/suggestions", oData.results);
                                }

                            }

                        },
                        error: function (oError) {

                            if (JSON.parse(oError.responseText).error.code === "MATERIAL_CHECK") {

                                if (!that.messageBox) {
                                    that.messageBox = sap.m.MessageBox;
                                    that.messageBox.show(
                                        "Item is not available at this store location. Do you want to check other locations?", {
                                        icon: sap.m.MessageBox.Icon.INFORMATION,
                                        title: "Availability Check",
                                        actions: ["OK", "CANCEL"],
                                        onClose: function (oAction) {
                                            if (oAction === "OK") {
                                                that.messageBox = null;
                                                aFilters.push(new sap.ui.model.Filter("AllLocations", sap.ui.model.FilterOperator.EQ, "X"));
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
            onStockSuggest: function (oEvent) {
                var that = this;
                this.openMessageBox = false;
                var sValue = "";
                that._lastSuggestTimestamp = Date.now();
                var requestTimestamp = that._lastSuggestTimestamp;
                if (oEvent.getParameter("suggestValue")) {
                    sValue = oEvent.getParameter("suggestValue");
                }
                else if (oEvent.getParameter("value")) {
                    sValue = oEvent.getParameter("value");
                }
                // var oInput = oEvent.getSource();
                // var oSuggestionPopup = oInput._getSuggestionsPopover().getPopover();
                // oSuggestionPopup.setPlacement(PlacementType.Right);
                if (sValue.length > 0) {
                    var oSuggestionModel = that.getView().getModel("suggestionModel");
                    if (!oSuggestionModel) {
                        oSuggestionModel = new sap.ui.model.json.JSONModel({ suggestions: [] });
                        that.getView().setModel(oSuggestionModel, "suggestionModel");
                    } else {
                        oSuggestionModel.setProperty("/suggestions", []);
                    } // Suggest only when user types 3 or more characters
                    var aFilters = [new sap.ui.model.Filter("Itemcode", sap.ui.model.FilterOperator.Contains, sValue)];
                    this.oModel.read("/MaterialSet", {
                        urlParameters: {
                            "$expand": "ToDiscounts"
                        },
                        filters: aFilters,
                        success: function (oData) {
                            if (oData.results.length > 0) {

                                if (requestTimestamp !== that._lastSuggestTimestamp) {
                                    return;
                                }
                                else {
                                    oSuggestionModel.setProperty("/suggestions", oData.results);
                                }




                            }

                        },
                        error: function (oError) {
                            aFilters.push(new sap.ui.model.Filter("AllLocations", sap.ui.model.FilterOperator.EQ, "X"));
                            if (JSON.parse(oError.responseText).error.code === "MATERIAL_CHECK") {
                                // if (!that.openMessageBox) {
                                //     sap.m.MessageBox.show(
                                //         "Item is not available at this store location. Do you want to check other locations?", {
                                //         icon: sap.m.MessageBox.Icon.INFORMATION,
                                //         title: "Availability Check",
                                //         actions: ["OK", "CANCEL"],
                                //         onClose: function (oAction) {
                                //             if (oAction === "OK") {
                                //                 that.openMessageBox = true;
                                //                 that.getMaterialAllLocation(aFilters);


                                //             } else {

                                //             }
                                //         }
                                //     }
                                //     );
                                // }
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
                        this.getMaterialDetail(true, sItemCode, oContext);
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
                var tableData = that.getView().getModel("ProductModel").getProperty("/Product");
                for (var counter = 0; counter < tableData.length; counter++) {
                    if ((tableData[counter].Itemcode === data[0].Itemcode) && (tableData[counter].Location === data[0].Location)) {
                        oPayload.Quantity = (parseInt(tableData[counter].SaleQuantity) + 1).toString();
                    }
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



                this.oModel.create("/ReservationSet", oPayload, {
                    success: function (oData) {

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
                            if (oData.results.length > 0) {
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
                            else {
                                that.showCustomerNotExistMessage();
                            }
                        }


                    },
                    error: function (oError) {
                        that.showCustomerNotExistMessage();
                    }
                });
            },
            showCustomerNotExistMessage: function () {
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
                    // sap.ui.getCore().byId("cardTypelbl").setRequired(true);
                    // sap.ui.getCore().byId("issuedBylbl").setRequired(true);
                    // sap.ui.getCore().byId("cardNumberlbl").setRequired(true);
                    // sap.ui.getCore().byId("nationnalLbl").setRequired(true);
                    // sap.ui.getCore().byId("residencelabl").setRequired(true);
                    that.getView().getModel("custAddModel").setProperty("/Code", "");
                }
                else {
                    // sap.ui.getCore().byId("cardTypelbl").setRequired(false);
                    // sap.ui.getCore().byId("issuedBylbl").setRequired(false);
                    // sap.ui.getCore().byId("cardNumberlbl").setRequired(false);
                    // sap.ui.getCore().byId("nationnalLbl").setRequired(false);
                    // sap.ui.getCore().byId("residencelabl").setRequired(false);
                    that.getView().getModel("custAddModel").setProperty("/Code", "971");
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
                this._oDialogSuspComments.setBusy(true);
                this.oModel.create("/ReservationHeadSet", oPayload, {
                    success: function (oData) {
                        sap.m.MessageToast.show("Success in Suspend the item");
                        that.getView().setBusy(false);
                        that._oDialogSuspComments.setBusy(close);
                        that._oDialogSuspComments.close();

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
                    "CustomerType": this.getView().getModel("custAddModel").getData().CustomerType,
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
                    "ToSignature": { "results": this.oPaySignatureload ? this.oPaySignatureload : [] },
                    "Remarks": this.suspendComments
                    // "ToPayments" : {"results" : this.oPayloadTablePayments()}
                }
                this.getView().setBusy(true);
                if (this._oDialogPayment) {
                    this._oDialogPayment.setBusy(true);
                }

                this.oModel.create("/SalesTransactionHeaderSet", oPayload, {
                    success: function (oData) {
                        if (oData.PlanetURL.length > 0) {
                            that.openPlanet(oData.PlanetURL, bflag, that.getView().byId("tranNumber").getCount().toString());
                        }
                        else {
                            that.getView().setBusy(false);
                            if (that._oDialogPayment) {
                                that._oDialogPayment.setBusy(false);
                            }
                            if (that._pAddRecordDialog) {
                                that._pAddRecordDialog.setBusy(false);
                            }


                            if (oData) {

                                MessageBox.success("Transaction Posted Successfully.", {
                                    onClose: function (sAction) {
                                         window.location.reload(true);
                                     //that.onPrintPressed();
                                    }
                                });
                            }
                            if (!bflag) {
                                window.location.reload(true);
                            }
                        }

                    },
                    error: function (oError) {
                        that.getView().setBusy(false);
                        that._oDialogPayment.setBusy(false);
                        sap.m.MessageToast.show("Error");
                    }
                });

            },
            	onPrintPressed: function () {
    var base64PDF = "JVBERi0xLjcNCiWhs8XXDQoxIDAgb2JqDQo8PC9QYWdlcyAyIDAgUiAvVHlwZS9DYXRhbG9nPj4NCmVuZG9iag0KMiAwIG9iag0KPDwvQ291bnQgMS9LaWRzWyA0IDAgUiBdL1R5cGUvUGFnZXM+Pg0KZW5kb2JqDQozIDAgb2JqDQo8PC9DcmVhdGlvbkRhdGUoRDoyMDI1MDcxNDExMTg0NikvQ3JlYXRvcihQREZpdW0pL1Byb2R1Y2VyKFBERml1bSk+Pg0KZW5kb2JqDQo0IDAgb2JqDQo8PC9Db250ZW50cyA1NyAwIFIgL0Nyb3BCb3hbIDAgMCAyMjMuOTM3IDc5Ml0vR3JvdXA8PC9DUy9EZXZpY2VSR0IvUy9UcmFuc3BhcmVuY3k+Pi9NZWRpYUJveFsgMCAwIDIyMy45MzcgNzkyXS9QYXJlbnQgMiAwIFIgL1Jlc291cmNlczw8L0ZvbnQ8PC9DMF8wIDExIDAgUiAvQzBfMSAxOSAwIFIgL0MwXzIgMjcgMCBSIC9DMF8zIDM1IDAgUiAvVDFfMCA0MyAwIFIgL1QxXzEgNDUgMCBSID4+L1Byb2NTZXRbL1BERi9UZXh0L0ltYWdlQi9JbWFnZUNdL1hPYmplY3Q8PC9JbTAgNDcgMCBSIC9JbTEgNDkgMCBSIC9JbTIgNTEgMCBSIC9JbTMgNTIgMCBSIC9JbTQgNTQgMCBSID4+Pj4vU3RydWN0UGFyZW50cyAwL1RhYnMvUy9UeXBlL1BhZ2U+Pg0KZW5kb2JqDQo1IDAgb2JqDQpbIDYgMCBSICA3IDAgUiAgOCAwIFIgIDkgMCBSIF0NCmVuZG9iag0KNiAwIG9iag0KPDwvQTw8L1MvVVJJL1VSSShtYWlsdG86Y3VzdG9tZXJjYXJlQGVyb3Nncm91cC5hZSk+Pi9CUzw8L1MvUy9UeXBlL0JvcmRlci9XIDA+Pi9Cb3JkZXJbIDAgMCAwXS9QIDQgMCBSIC9SZWN0WyA0MS4xOTgwMDIgMjU1LjIxMDAxIDE0OC43NDgwMDEgMjY2LjAyODAyXS9TdHJ1Y3RQYXJlbnQgMS9TdWJ0eXBlL0xpbmsvVHlwZS9Bbm5vdD4+DQplbmRvYmoNCjcgMCBvYmoNCjw8L0E8PC9TL1VSSS9VUkkod3d3LmVyb3MuYWUpPj4vQlM8PC9T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RO1rh+19BzfEuRGLJ9S/eWIlMLkMe7//jZSsMFf+ooxEVMfsRVAZWHO03mhlT7DWv1Mx+fB/URc5vQ0KZW5kc3RyZWFtDQplbmRvYmoNCjExIDAgb2JqDQo8PC9CYXNlRm9udC9XU1ZNQUYrQWRvYmVBcmFiaWMtQm9sZC9EZXNjZW5kYW50Rm9udHMgMTIgMCBSIC9FbmNvZGluZy9JZGVudGl0eS1IL1N1YnR5cGUvVHlwZTAvVG9Vbmljb2RlIDE4IDAgUiAvVHlwZS9Gb250Pj4NCmVuZG9iag0KMTIgMCBvYmoNClsgMTMgMCBSIF0NCmVuZG9iag0KMTMgMCBvYmoNCjw8L0Jhc2VGb250L1dTVk1BRitBZG9iZUFyYWJpYy1Cb2xkL0NJRFN5c3RlbUluZm8gMTQgMCBSIC9EVyAxMDAwL0ZvbnREZXNjcmlwdG9yIDE1IDAgUiAvU3VidHlwZS9DSURGb250VHlwZTAvVHlwZS9Gb250L1dbIDFbIDE5NV0gMTJbIDIxMl0gMTVbIDE1NSAxODBdIDE4WyAyMTIgMjI5XSAyMVsgMzQwIDM0MyA2MzYgMjIwIDIyOV0gMzJbIDQ1MyA0NDAgNDc1XSA0MVsgNDQwXSA0NFsgMzc4IDMzN10gNDdbIDMxOCAzMjBdIDUxWyA2NjcgNDUwXSA1NVsgNjY3IDQ1MF0gNjBbIDUxOF0gNjRbIDUxOCA1MjRdIDY4WyA0NTddIDc2WyAzNjUgMzY3IDQyMV0gODBbIDM2NV0gODJbIDQyMV0gODRbIDI4NF0gODZbIDcxOV0gODhbIDI4NCAzMjBdIDkyWyAzMTIgMzc2XSA5NlsgMTk5IDIxMCA0NDYgMzY2XSAxMDFbIDMzNiAzNzkgNDMzXSAxMDVbIDQ0NV0gMTA3WyAyMjldIDExMVsgNDQ4IDMwOV0gMTE0WyAzNTEgMzQwXSAxMjFbIDIzMSAyMjldIDY1MlsgODIyIDgyMV0gNjcwWyA0MTVdIDc1MVsgMzQ2XSA3NTRbIDQ5NV0gNzU2WyA1MjBdIDc2NFsgNDQ2XV0+Pg0KZW5kb2JqDQoxNCAwIG9iag0KPDwvT3JkZXJpbmcoSWRlbnRpdHkpL1JlZ2lzdHJ5KEFkb2JlKS9TdXBwbGVtZW50IDA+Pg0KZW5kb2JqDQoxNSAwIG9iag0K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MVsgNDQ3IDQ1OF0gNDRbIDM3Nl0gNDdbIDMwOCAzMjAgMzA4IDMyMF0gNTJbIDQ0MiA1MDBdIDU2WyA0NDJdIDYxWyA1MTldIDYzWyA3MjAgNTIxXSA2N1sgNTY4XSA2OVsgNDU5XSA3NlsgMzU4IDM2NSA0MTFdIDg1WyAzMjJdIDg3WyA1MjIgMjgwXSA5M1sgMzc2XSA5NVsgNDIyIDE4OCAyMTAgNDQzIDM0OF0gMTAxWyAzMjkgMzc5IDQxNF0gMTA1WyA0MzUgMjExIDIyMCA0NzFdIDExNFsgMzQyIDMzN10gMTE5WyA0OTddIDEyMVsgMjE1IDIyMF0gNjE5WyA0NDRdIDYyNFsgNDQ0XSA2MzVbIDc4Ml0gNjQwWyA3MjhdIDY2NFsgMzk3IDQxNV0gNjY4WyAzOTddIDY3MFsgMzk3XSA3NTFbIDMzNl0gNzUzWyA2MDVdIDc1NlsgNTE3XSA3NjNbIDQ4OF0gNzY2WyA1NDddIDgzN1sgMTY4XV0+Pg0KZW5kb2JqDQozMCAwIG9iag0KPDwvT3JkZXJpbmcoSWRlbnRpdHkpL1JlZ2lzdHJ5KEFkb2JlKS9TdXBwbGVtZW50IDA+Pg0KZW5kb2JqDQozMSAwIG9iag0KPDwvQXNjZW50IDg3NS9DSURTZXQgMzIgMCBSIC9DYXBIZWlnaHQgNDY0L0Rlc2NlbnQgLTU0OC9GbGFncyA2L0ZvbnRCQm94WyAtNDM3IC01NDggMTgxNSA4NzVdL0ZvbnRGYW1pbHkoQWRvYmUgQXJhYmljKS9Gb250RmlsZTMgMzMgMCBSIC9Gb250TmFtZS9XU1ZNQUYrQWRvYmVBcmFiaWMtUmVndWxhci9Gb250U3RyZXRjaC9Ob3JtYWwvRm9udFdlaWdodCA0MDAvSXRhbGljQW5nbGUgMC9TdGVtViA2NC9UeXBlL0ZvbnREZXNjcmlwdG9yL1hIZWlnaHQgMzEyPj4NCmVuZG9iag0KMzIgMCBvYmoNCjw8L0ZpbHRlci9GbGF0ZURlY29kZS9MZW5ndGggNDQ+PnN0cmVhbQ0KSIlqYdz+4F3mm9YpfKyt3ysMExgoAQINAg0MDKfgfEYPIRiTBSDAAEm+CloNCmVuZHN0cmVhbQ0KZW5kb2JqDQozMyAwIG9iag0KPDwvRmlsdGVyL0ZsYXRlRGVjb2RlL0xlbmd0aCA4MDg1L1N1YnR5cGUvQ0lERm9udFR5cGUwQz4+c3RyZWFtDQpIidyVe1QU1x3H7+yyw5jgIgxrYBZnVsUHKoHa1BhI6yMivkUM+EAUll1geewbloUgiKLLAooPXqKAKKCAgIKIL3ySoNQYFS3BNkaj1aQaGqPegbtiZ0lbzTmNPfXknKadv+5v7szv9/n+vr+5gwEbHsAwTLxkcdD8aTPHT5OppPJp2jCpItwjQB4ZHxumtW57sWLWNcuOZodhrLMNS9uJ+h37n7oKM1xtgaC3224E3G3P0g7sULtRrp5X7NyAAMNw4cbiuoF8s2VypV6hNw4EEoVOIlfoo+RaSZhEK49U6PRyrVwm0WvDZPK4MG2MRGXdeSmMkPzw4mIj92icTjJbGa7SqlXaMD33mkIp4XJJApUKa7RYz93UScKUMk8ui2qgSrgqXqnXKuS6tz1nLv7QqJZLJktk8oh/pRRgQACAPQYcMSASAAkPuPGAOwYmAODJB+9gYDIAvwVgCgY+AMAXgHk8EAjAEgyEALDKBsh5QMEHWgwYADBivBjAUwNeMuClAV4hxtsBeCWA1wN43wHeY8BDgNcP+L6AzxXlLj/gxxkBFoEn2GTMjH3Pk/Id+BdsEm36BVn4Mvyh7V4ilXgyaMsbc9/E3/yTnZ9d5WDh4Cyhg7DaPnCI75DvHK46FpEJTqOd8kXThwqHHnirwHmpc7/LDoqkYsU8cbPrJNeuYTm0M51G9zC5EgdJ3vBBwzeNcB3RNbLBrWDUx6ONY8aN9Xaf794/7tT4jAnxHus8miVZnb39nVhWJ9vdye+NHdqX+yy2P9eWZfv8RCjbQqAslhCwdc9OiKwrmMXaCix1z46LrCuYbeGi+l5rZLFFWRZCILREmRKqEvqqDDD/qmN9x+UHZBOcqhO1dVQe2niGyD2c80k7BVPWw80JUEmnb4xVycJUkS7FaFopKkFzKXdb8qPZ5hlr5tFwgatNuShTochUiP3fLT62va60rqDAnLmFyTflpeTHEzl4cUlxaQVVoS8Pl67QxkTTKk1ilJoKrY47mkKbbJMyDMnpabow5xxTZ+3tip5il6LSwvKCPYTQUmRldISDH5Bl0P4/ggv9AU5o0WRBp763DLsNjhD/M9kA+6CTKAVfrcnZpmVkRZF7O6hztuRn0JwFC5Khil63SamPjVZEuGxHUfkoGAVQaEz2jPb5tLSpNblbnI8LLaO5jKyPAYO7b/Chk01gcoROvT38DFOAQ48r21tamMZT+9quU98GQoeQP9LrcU2MVq4LJU6OOua+gkqKT4laTSev8jNNEkNgeVfUqDgYczBi/97K2l31sqbweuk+daw6Sh1JCLkycK2h0uDoy+7kwF+qVILf6q77dD+zCZ+6/5r6obgcOhnxIFlRRQyjK0nfW0eRn+3a2lzUSmdsmblMiYAg4COf2N+JH72yHJqSCl2wnvMs/wwfFrJnRSEr4sL14UTcktjps6hxtT6XV9KGfY1rTog7r1ZcPM/UHNh1u51qyKxZ3UwroAD5Q9v5bSnrnddHZyiiqdPviz5WtK9sWkpUKiqlCiohNT5GTytWLDUsEv/Gu/3a9bZrX19nUtiRItkhRa20RqtRRWsiG6PrY5pkVRWlFVWNBAws/OlNIXLl+hMN7R3vfvUcc0gDz8H8NED6s9GQEZENSHDgiuaheBd00uGr5JtL9UxcxboW8+VM6JkFvTZATyINV+vUSq1y81RnNHXCCK+wiYR+6ZoIJUWqfboiHtOk/+cXSvacY0h18lNRon9IeqjYb+GOg6fuX4Mz7zFhbMDrgrMfhENXdrmhzODYc7nP+wbZ0ve8W1R1dE/LT82MKXP9WhMtNa5MDUkjNIiP8CQ0SIw2oeAv4MrDea0lHGVX+A5BqHeyjzeFzFAxCu6jyRa4HG67eOo2Y8nudXpdWgv9s037ePbh61L87J8CXMDGvLaB5ZyB4/9OBP0MDVYjySBXwSLuaOGKywsqohlN6dq9jRRZXVNwLL+GKz532Sok4Sz8KCTNZcBCo9VCB8Tffvw95v1jQTfuUwNO0mT+CyeFbZ53AujFX8E3EuAwMRwCx1bthwRDBl0ta91dW0r4HbiUyEnGn83pDX9dNT3W3k54ugEKHX37ZnEn4UvNPYlDLzjy6G1IMdAHYrVlZ3fezHQ59diU422el72wILjEhWy4gLxG7J4lRnYTZyL+WuY4chbk4fvupp4Q1FQd2nlOfO+JOpSDNm8QoCFIirwDEDcLeov9K46iG1Ymj8emAaY4bqDNZAN7D54XvciwAP8n5REcToJ0yx3IMBw+xykoqz2744b4/KPMHME7+LyFRSXBjJVzolv5v+ck2//gKcpMNBsTKWR3ayUU0dXQSY27+VZ/uYExZQssPpZ1r0D/3vJ76MAu5Pi9Hll7CvnXWQMsJ7vYNtglQjn+KAQtQukUqoYq5ASLr1zcmneSPlN97kjrIVOe8+r3JqX/SoxqkBraQRlD3ocu0B0SUHOTPlIMPZovbfnkr87mnF+bp2UvLwze6UJ2dfxYVhuamL+xqttw8x+qLq8eUPUA2gz/sawz0GnpC1mowmL3Cln/lSn5Rc/B/6zTv+iuWhay2f+PX9fzV8qawzmCfXOI35vP/UGS8KlzTn5rZNRwTCx8OwK6ZWxy1sTER+qjiKNoSj1y8aN0qriIBFq9Yp4+SDxe2vrFBkZmEmRqzTothQad94M2n16qbLxIN1eU1Ww9QOTiyOHgdfldcQkuRKGo6T5704Cxxg4+680WibRSvVQfenhW4/R6H2Jz0tbEJCrNlLw2iZ6NxiI3NBgNNxOrIrfmxTJpCsGyh1+qr4lPnK7saGc+//rYN3coyLO9pTutOUHPgGKBEPmh3ruwlFOzsXc4nx0H/yJKijZGGELKg/eEHPywMGlbcm4qgf7GfJUGRXGmYYhOTxuVVdpR6NZuVJJVcT1QkhRREBXkjoKIBwLDOZzDOTNyI8oougyXXMphgIEZkRtFBJRDHFCiKIoH0eCRmETLI9EX+LbK7cll3F3J1lbt1lb/7P6qn+M9nm9BJFqPFiOS2uqTlRvCxPhx3O5843edujZ8HphbjPx07vlmMjslJyWHlmERpcd2n6SK1Xsd4c63YI4D81+mgcxg33hB+X9DEq2ClHFQ9LM1g6bDLO3R8HtE8WjDyDpeQEhQkNAfJ9xzN+bYeJFBYTHCHY51g+VptZlsBJF9JuAQxYHzk4MFobgkxD8xmAoUFSoV5a31FxhpmknI5lU7LNZFLEvR9XvT/UewS3fzrqjYeLUxvSq0g7rWWdPSxGRihPvW6lMBJ6hzZ5p7a5mCqoKuJrJRqoq/TmvBJvV82S/+nE1rY7eImrEstqgjscUWFbfYCVKT05l7kpammm5NdNsrkUbrxrtH+weJ8cQYUbw/5RWllNdk1ygGGanMVBC+MUYQJgjbpSsODVCjjWDRyptr+35Cu231tg3m4X+Atv04i1aGmR9ujWOxdpX3dTLpmGNplzdMo0qx/1sN18Dadyc25BT37pft4DdO1gOJ2pqD4jJxFfC0x+YMEhVvR/ovhovvtjOpmFnHk0CYSb24fLhQxYS9fJT4lCpjpdLFKs4d7eki2avFpI9/QPMM17s42tArTOxWOKzECRW/PE55hlRkHMtipUqPjImMjhTpJvokeSd54Z/FbxCyuW+smMceNoD34L3H8D714Ctbo1wm2D90u5iOdJoX8SFFqAw3ZeX4MlqjM9A90IMtLODjMF3zYd/siQcGJ4wqYSEPDH4ACjTV5/ut2PMhfpE7IugAy4VhiylDO/VpPiJ4sQPnk2qpF18dKlYx8H5db6/8Fp6tzFQqyZp9DaIGujvIro39fqWzgw2zcrW9IUshBYt/GnyTfynpoE6QT5hAIug1qNI7hLj4ck80ZRGaSqFZiHMfPjlf2FNxkfEu4OxcH/Qh0iDRusdoHguVAfoecNvoIw05LYcu4DBhNH6cDobon904C9PZTmkwHSSe/Ws31nQ8CwKdX6iwS+sNmUqWTHKduIHuENp1GPxGxk5Nhl++64/cQMX/hpagP8oZj8WXLIvXr2UJGq81QhI0oBx0tSExE5be8c0YOXOdqBjZDI28o2dzu++ToCEFjWTQoInSi60cx4fBV8+RezI4RMU2b2GAKxmY6psaSGcjLA95o9mk/n7XuK2007KlqUtylhbqSuM5hKR5ewu/xWtwt064h5S/1yczSYdQ3oepnP11jftbKfbC+7wEzFqZ7NqclkJyIFi18wR93NfxqANlbRkmcGSICiv+p+Zma3BnZMQDE9AH/R+BRxFK0Pzyk/UHmYQYcVRwLL5lLqIjURCl9aPaocMwWxuM1HRO32XV/51FVzDwBPOMUpjDiJ6/SgAuVQIzvDBvz4OyMKb8dElLGwl6CHuJpttZiPw20xs8zG3NVuFS7B/luPGWHI/+SQ5/NOsXOUyXcYZnssgNgfuIRQ7Yt0YfM2ZuyFeC8imtD1i8IxNhsua3X0/4PVAldvtmWfkwA1r1g5mwvPMsTNNJTuN4osnLAk2p4C0lCi9mU5OwtZmsutHycuDMrp3tdGER57mziWoJtWKd42oXJsQ12t2dXNls27+TTuZGO2xJ9qa0Vqr1iYTJi8RyceMLbfPRbiLr7f/ClFflD+BP7PBb8xim8WEipYAZnthHpoXVloyMC2vBiEMcqWJjpdLsz4UIpxYujY5azRBdgVIOUeqFuKn7OUrsiFwSUco0uzdvPhWIS7kuc833GbHl+4RHZLlUulX5K0VF4uJdh3EZlziS3a3KuEj1q+LjOhgplyi1sbffuZGPa2X8bRBmssXIg3RxibjpmfbtS8TAiBO7nFhks5zYDmgG3ibsoxUFPyNzAmMOMVQCHBaZQf5vyFySOMQDd6SZvptDDKTlF2bkU0Wfh7Lo6rxrXRoDcKS/HFHss4FE2cBHXJDe7s4uOEb3VHXUtdXuKdCJsloev4BCZcgWuLAKNGDS92DxkMkFDZ6PQlgmUEQW+clZLmlcYiinoy1zmOq/mBDfyezlEgM29qZu1h5sBFmnFn4EFmjC/FNwuuMtswuwS18XNgHBuALxVPKUYmd8AGa5NSPbm6m/LL/6DdkS2xx+ir7i41bvS/na+jg6M5bmEYam5PbU7cec6EQ3u9jNFPR08ozKfFpiz+HXCgYf3aQalD5b5MwhcZ6fL+lhaG0RSxuPmo03F+LQXra/Cli97WGm5neXRqaoYKBnwhgNFrxMSbpYQgrtnO096LVoApoUsYRCNmgm+7FPW15nUTfDz+b4mETof0CifWCFSNgGprBo6N4TulJR3ZRWieeckJ0+Q94NfS7pooHnbN1rTFnZOtgIGLFvtJsvaZbn3OlFB528EHeNOlEnS69kJDCdlxwWnOJLobmOrY0tF5u6rnVZIew4gwQjJ969NMEpd5yNivLURkyFyez0n6XZ2gOqL97yYggDC8DlV3uZ4/X57RfI76MGw/pomOpqfcOYcnUL9fBkdmwLWWtGhqSHZ4lok6oHgYBT1Q0HZNXMX/ccSNpDhjp520joKIc16oq/Ant4yDAF6ZQOkbXtbX1DlxcsLqKR90jmf0rgp6uH+ejQr3ePTx2q+xwZNBtWIG3Q03usaNXhF2wqdarCU7n9NcBpgilNdxTDFefzFfVlDcWN0nQdVG6EEoznW8btjolNisWjghKFQlIik6RG0XlRRyPkwld6T/Qal+PZ4VkRIjI2OFIcR7tZG8QaU55vQpIcg+r7MAmWHWRHRUmI0qPSHf/Llb4NoEUVYVoKtBD0xgrUmfI71Uj6kCCDaBjdMZbDhokwkUgUK8L/zny1RjVxoFFZTtKxtrhliNWZszOrZ6GrpWtbtZ6qW3wVEUVAHiFBCJAE8ibhFQggAgKCgoDyEAiPEN6LBtjwkPcjrgIKglrBJ1pZVyt1T0/3Cx327E76q/5hz/H0x575P98399757r1xUaeUCoyXF5ATQpRSkQWUG/Uxps6KyYwh1KECGUeFKLhHY13w/UdqB0NIUWd83xXMVHZFP0KEXWDwtyu3b8c26Z26fAmvnmn5E/z6bKVxjOyoa21u7EV6YMPpRxMYsE7ClnS626G3asurtOXliO8D2cwUZrPEpkH8yU6tV9uC+yPU8EsBlDBbLxdUtJJdumpjZR9S/7fCh7ACA+sUeD8D3iGqyyrLtGUIOsmek81kj5/MXRsdGxubqEHU0clR0VhoXvDZAPp7DhdS+7KprQg7LkykJqKCQjOkuM3SRstYTG0Fhx+/Iboy5nfjPSONNJB7mm5Kn1tqxXG6VkgnuuBKFmTGQhKZnv35ZzkcRgmlKaRcqABsf5xUriE0Ml5iCG4zTWXTycuKFsazq+aCR9aLkp+iWNIIuVwuQaqWsHNUEfUpFpienHmCxpYv4yqRcI6XBVsP/XDQ/8Z26lbFz9i2XWzs1XYV9Of3IWeZ7KaBqGm8HOxOMHlnpAXRZYhCF2O6jEFqGshT4TRhQ62G3bAa1sMq26fT9f9Z8ZUlcVidWFGNTpqfgwOrtEHb/hesIr02tYzgz/iNu/UjjcLg4gBcJNNEKkllpMI7BAvL55zjEehzvlJxLMYL0QSl8AIx6XlugZgYo4T3qIBs6t3qU2uLugu7+7D6NEOajvCG0L3g/QNWN9gFvyHQyflnSYnzpBOwWMVHXfPFuB8nLUlEntcVXMoznOpfm19RebYCf3F1j9MI3VO3WRoGAijEAULb4+dviqOM+WzE+LSGzGeiyr0LC4ELeLehZb6ShH3x+2AXZYP7h0SKQ8lQvirkBB9BDZRtmKffHhyEsIF1vb67aQQfve5CfVxPosqUjOOZCTg/pLhUSKIGd71fk7wTsfGIhtUO9IFS/Tz9CZUESajyTXnCitHBsTpaK6jh3jaw9b57BtFVFVZV0u8s1RbU5DXR5KAiF+Og2mShR8Pc4XvxcjTpA8yYlohLSI84VMvFXXa5Uh8ISEe5mL0Bh3D4kNWvNbYM4e1dMo9WOnXV8Kt9BFhUXGasyFNbE0igIp7+UH+yAbEpcgd8N9jZ3rsNK8dQpXm9OZ3FPrrPbc/BQIHATbMfORF0UhiC7W2hVl2mWEQH9V4HherWI0XMAmMhrY8+NnzpA7sI8b8SJtqxNsPgvWsEDdTuHGBQBBD4+NCdb86RedkMVOnW0SWbwSvALp7pdUTfoiCDB+Q9nCG2idPrbUSSKIL1xKXTt4VDA10jPq+Kw2Lk8SJvga5GQQS2yYZuYKiyvr2+tJSwGaZSwN5iaWN0I3Ex32YpgiPpp4ldd7B6F1LCKfV0xmIj5DwxwT38R+FOfPf+2rYgUnApfOAx1lV1t3mMEFYyApz4WygUo5xhFd1BPeBdYF2dnyPajI3A+B4DRyGgzvAhQf0IqmVsdsnBEvl20keg+p71m/UBPpkq6ewk2wYaTHewBR/4IOA+kc5USSOEkUFIv333xmOYJjpRdJyI5x049QVuWlyzzByLzaXSKc/2a7P2TRGXM+dmL95otiS85tvKV7gO7OKYvoILNVIysjyl/iKGTlada7/QR6TlO3MU1ArG0YSdsq/w5+as5dLDGuo12APPcoMmzBOT1otfmXewVOLoMHVYlZBW9x6kYWuegI8JFL+AeXeDQUAKLoYPLguz4/SzSaL2UsM/cl8jOUxZS1fiFcuJTGRu8rnwVEFGTcT0hd5CqGngLbMgnfC6XsIQ2AAbbK0g4BoYp6zNPbCaddIj2COQi9hvdvBzwLn+5/VcMkHKOPD9C/nf8YePhwD/lhx4oHv6nDYB1QvhJDEt8PmrJ36MI+EEkAJOhNdBjFr32htWdnbmFbUTabCSlRImyBDiX27puGYY7788Z9rhUEufFvul915BI01LIKy1goOj1uZXtINDcLgjsDbjh31DvIWkIiSaTQfR3//gCkFED/O4n4Tvz0W2bPuU44C7+5dUCkiNhOHx8nXwPD4A1oOw8i5pHK2fzR1FHoIdk/psjav76RJv0k17rKEPaxvpHjYY1GFNRHOo3rfQi2bJdQmF30GWhaUp60VHer4zxcxLZMAWsAry15Gp6tDIwAjEg3p/vXIz/snWxtEjJHswfPYxdqP8gfGfhLCM4eUopPCPMIqh33TNmThk+pbmHIeP4OhNQIBFFlc2TdFXPav6VB1honeyWSJ+LcHD3qUDbxubfvXfATzffpk7lHYODoDdwx+tzMJB2FdgvehqjmRJfGM9pZGIJkaZHIVLwvNKo8iYUpVOVY2kMCWUXb93L1t3eJ1QxA3wITb/+U+cP+BicXGRikyUMvxfzsie4P0zAws3yFZT6XB2BZJdd7qoCOvMNCb1Edcz+nsbriK5TL09g/qirdcHVuFaS8gIV567oCID61STid8kzKV2Z1Qh1Kp/Vy7zH/1f7x4Ax96Wk8X8pY0LcIWWSaYltZrTekE5jN43c0HISuQlh6SFIa1BzTwJ5i/iHjpIuOzaznPE+fz88mAyIZxxaP6+5CY+frPp2RzZd003kjOFZBuzjUZMl1GTqidGG6eqXjUi1DtZk04vcFNvzYiRzGV+re0+bsRNI3XXh8k8ppd+RAi/xfVgF810dK6fJdHvDEXDxR1ERo6TXzIvLTYjfl1SULxErkaSE2KSJLhA01jbUNReMktmnHURyRxiJMrYdWpVZJoYd3Efm6g4U5FbQWbmM9D/8l7mQU1ccRyX0oSIlLYs0bDr7OoIooKKV7XtH9V6VAEFlcMOUYEAJiEXSUiQcAvKFUEQQjhFRQzKfQhawyFBlCoIiIgX4ihW6NjRaV/I07GLONrOSKfjtM7+szM7b3a+n9/vvd/n3YYMAfzSF9K8yJhz3sQkz9YZb1Lq44aQ2wZH8jD467q3i6z+0/ijWM/5hupyIp2K/LSjvCGwDtM1nr1cSeSV5bXWo7UH2iP78LiDgSI+X8i1ynJVOfmhfHGY0Gt71Y3i1Mr0U3hcigubzMSbs1/ADqKFiLjRAgy81Asmry10j5j8YzPg/ENXBGfIDAXj9wR94ulzg8w+5OSYnUFND5bJ5AopLXxvbDAP3ZWxSUkaUk0uXHsYIjboYs62nVw8LjnxmqI16KyV6/NlYLoDsD7VynDscLnor92fyIgI4boFo9zSrT/b43egWY9Nx3zdsvPfpbKsN0N7H+geRIsyCe4alDzGbv9Wqu0imqpKGk/cpOW1ZPdeRYF5PDDZD8xxpP14zpH8bDVtZx+7qw1NSyYf3FydJCOHIzSWTVy/9M+HEPuxVYZc8kIgFYm4tFQ4NR2StUDh6qT1LCc8RCAV8gXxyQxloTK/EO3wH/Dtxt2HPfo9ekvbGBvr1jd4NtH2U6NECpYYZTe5aDfgYC0MG4FLc+fZOcPPneFXW1JiGUgyMIqm3GpUFfcQj+vud1cB67REBuIG3QB15WOcNNF9VHfmmXNyQqJL6H+AAs8DYEcc8MTfMga7eiwKO/TLJ0BXTQq69uODHngPaDg8TE/gcBI4mOvKnHPZZQVlKlViQhqRGZ8RnhlMU1Jz8nMKitAi6VGWL1McyMWFQSFsEepdwj8bjsebhMbJFTFREh+GMr739FDR0xwrdUHWUdVxsufgjh6Avum7ux0ATADpnhTI9Y8P5Mn7gJTMNNz5f5DAuTbAOAZYVgDTsX3yIrkF4D4EyZcRHkgaoiN1kFrdv/ox1jvYCb7Q7m3ilxJlfJ8CH4zJipT6EgeUlIgHB+6CLrRX63OFezWh20qVpDqYh0cfCg6V7w0PtZKIYoVcZroTC0V40CEFMvOgB+69ZZPQFouhvhUFNXWk/URbN4GU/dpKzz6qSSvGzpTIJPlEoSibx0ajIkJjQzDHNa39EsJcP/8FDcwCYcDSMFtudK9rbGtH9bCxQWUopgcKRIHkNkyHCw9DWzgThU4xbAfyRGUt4cNPFR7wE0ZqDAXMiwJfc/1RKc8zwJNHc3eYK7PDFq6u7XElfC4qrnSjXfmdRb24XzbFdyHHFpqhs8qXdq7FPS4M+Y5ggAFWnAOLwBJCo8usK0V7JJVr8/GDJp3VbdqjD8hJCq2V1yADrBmfo+FUb7/MUjaxuzXs+hAK+AmAHwXYuDmQQjNgFUEGmCE/RgKnPtJ3X0KYYJQcExFBysNiwk+952QH2mpCViExCagUQIjHpgikPC4nwCobsjOhF9yGQtvU9e2bcd8abagOG2iuulBBDj4kF5oWDi8YxVo7uwBO5JgcTKYgzHUXddxBTAUsI6kbfyjp/55Y1+fa6zJAi6budgn2Fv+4Z51023YeLUzkv0+CgVPAi17rXudV4UlDcov9D8mEqLeAL3ZwfHoTR5g1eRUlOjLEKlgPZunz5GVyi4fjRUDqx8Rjs+kSbpCfxO/8osqVeWukgt0iSAn1msNIm+D+LWecu0fADh7NzWGu/O/ckf4J8kj9v2N/T1YOTYvxU02FLe3oddazrYCKw+WAP7lhLZxpOPKhEgMqYTPAwDfAcuR3oyc6fU0LsM8wBpfHLCf/n/4RtHunb0GxUkzIT32tb6JjQceiExl74PRGT60bqW9qVvoeCRrA8VvvhbM2OCo2YvAzaPoLsL2c1aQ+S7CzKCJn6er5KHQGxmR/bbk1UFR7BW84XVZ+vJJW2JLW3IRej+6Qn8evKOtrXjtdkTUFrqjWOpFOlzPei0Jx1munE98Yd7roBtLpuC/7PxTHi8gUmdGlZ8bAJ5ReWXG8sigqK5bYnuVb1oS21FX3aXBFPWWBCE5xhKao9X2XFtx8ipGR0Sw9YTYXPzJlY0yU+lVS0rs3M5P6mYv/sOBr9EYagGluasA+jVpzUkN9YaExwY/YvDKbmmFmmmQ2bdQUTJum97Qcu0H/U4ABALT9HJUNCmVuZHN0cmVhbQ0KZW5kb2JqDQozNCAwIG9iag0KPDwvRmlsdGVyL0ZsYXRlRGVjb2RlL0xlbmd0aCA1NjE+PnN0cmVhbQ0KSIlclMuOozAQRfd8hZfdixZgwAQpisTLUhbz0KTnAwg4GaQJIEIW+ftx+3h6pImUSCdF1b1VNhXWx+Y4jZsIv69zfzKbuIzTsJr7/Fh7I87mOk5BLMUw9psn99vfuiUIbfLped/M7Thd5mC/F+EPG7xv61O8lMN8Nq9B+G0dzDpOV/Hysz69ivD0WJbf5mamTUTicBCDudhCX7rla3czInRpb8fBxsft+WZz/j3x/lyMkI5jzPTzYO5L15u1m64m2Ef2cxB7bT+HwEzDf/E8Iu186X91q3s8s49HSiYHRxrKHcWuVLtrIemoiKEEkpCvUkCKWArlxEpoR8wrFNAOKiHlSKJeaCh2VEaQ94IzmRKjB5lBqEu8lPiU6JXoSfRKr1dD+JRMIqHbBC8leklMjJoJXiqcJXip8JLgpcJLQu8VvScNVENeDy8pehW9pwkx8lJq1q5mkjL5iCopPdQVhELtYy1EfxlVGpxlnFFKRxk+G/QyqjRUyfCZkqfw2eBTcUYtk1DMpWFmih6sXUeot0xJcUatr5lDeFEFecxFcWItzlQFudOUUK3oTzGJ1uXJ3Pmsc5zlkprcgpyb3OIzR137J7kvGp856jqlptNruNdy5xSaqHFUMEFdQb5KDeFM5xCnot2bI1vtfHJiUrt51jt60Kmf0t83Umrff27zJf/4aimd2wXg3/SPVWA3lvjcM/1jXe2KcWvN7ZaPrTJO5nPzLfMibNbHN/gjwABLmTuVDQplbmRzdHJlYW0NCmVuZG9iag0KMzUgMCBvYmoNCjw8L0Jhc2VGb250L1dTVk1BRitNeXJpYWRQcm8tUmVndWxhci9EZXNjZW5kYW50Rm9udHMgMzYgMCBSIC9FbmNvZGluZy9JZGVudGl0eS1IL1N1YnR5cGUvVHlwZTAvVG9Vbmljb2RlIDQyIDAgUiAvVHlwZS9Gb250Pj4NCmVuZG9iag0KMzYgMCBvYmoNClsgMzcgMCBSIF0NCmVuZG9iag0KMzcgMCBvYmoNCjw8L0Jhc2VGb250L1dTVk1BRitNeXJpYWRQcm8tUmVndWxhci9DSURTeXN0ZW1JbmZvIDM4IDAgUiAvRFcgMTAwMC9Gb250RGVzY3JpcHRvciAzOSAwIFIgL1N1YnR5cGUvQ0lERm9udFR5cGUwL1R5cGUvRm9udC9XWyAxMFsgMjg0XV0+Pg0KZW5kb2JqDQozOCAwIG9iag0KPDwvT3JkZXJpbmcoSWRlbnRpdHkpL1JlZ2lzdHJ5KEFkb2JlKS9TdXBwbGVtZW50IDA+Pg0KZW5kb2JqDQozOSAwIG9iag0KPDwvQXNjZW50IDk1Mi9DSURTZXQgNDAgMCBSIC9DYXBIZWlnaHQgNjc0L0Rlc2NlbnQgLTI1MC9GbGFncyA0L0ZvbnRCQm94WyAtMTU3IC0yNTAgMTEyNiA5NTJdL0ZvbnRGYW1pbHkoTXlyaWFkIFBybykvRm9udEZpbGUzIDQxIDAgUiAvRm9udE5hbWUvV1NWTUFGK015cmlhZFByby1SZWd1bGFyL0ZvbnRTdHJldGNoL05vcm1hbC9Gb250V2VpZ2h0IDQwMC9JdGFsaWNBbmdsZSAwL1N0ZW1WIDg4L1R5cGUvRm9udERlc2NyaXB0b3IvWEhlaWdodCA0ODQ+Pg0KZW5kb2JqDQo0MCAwIG9iag0KPDwvRmlsdGVyL0ZsYXRlRGVjb2RlL0xlbmd0aCAxMj4+c3RyZWFtDQpIiWpQAAgwAAEiAKENCmVuZHN0cmVhbQ0KZW5kb2JqDQo0MSAwIG9iag0KPDwvRmlsdGVyL0ZsYXRlRGVjb2RlL0xlbmd0aCA0NjEvU3VidHlwZS9DSURGb250VHlwZTBDPj5zdHJlYW0NCkiJYmRgYWJgZGSUDA8O83V00/atLMpMTAkoytcNSk0vzUksAknq/JD+IdPNI/dDlvGHBMsPOR7R34a/+379+uXDOo1H6fsv/h8Mgt//8qj+aOZRYWAFmsfAxsDH8JzhCyOrY0p+UqpnSmpeSWZJpXN+AdD49IwSBUNLSyMdEGkCJs11FIwMDAzApIkCWI9CcGVxSWpusYJnXnJ+UUF+UWJJaoqegmNOjgLYiGKFotTi1KIykCDE0QqZxQqpmSUZqUUKiUDJ9Eyg/qLUFIWSosSU1NzEomyFfJAMEjcNj1UKmXkKQLMUQvMyQbzgEqBgsUJiXoo+0JR8sC3J+aV5JUWZqcV6+m7BIZUFqQoWCimpaZhBCARcIIKJkdGv7kdH994fb/YyAkmVvczdLD86fgb86WD73vf7qOhvu++TWb+/YPut8PuA6HcQ588k9j9scWD2d7vfQD7bj/2iINZvEI/v+wb1MsbvaleYH//mFT394Nx34e8RUt8jPb6LeN+Vc2e7rHHwt8hvd6nfHiG/xVw05PhAscn5Q55Hbf2PCUL1039UTP+uN3369MXT2X6nTb8xnV1uQVI8D2c3D/c5rsfcj/t5eAECDADkKNCRDQplbmRzdHJlYW0NCmVuZG9iag0KNDIgMCBvYmoNCjw8L0ZpbHRlci9GbGF0ZURlY29kZS9MZW5ndGggMjI4Pj5zdHJlYW0NCkiJXJDBasMwDIbvfgod20NxmtsgBErHIIe1o+kewLGVzLDIRnEOefsqbuhgAhvk///Eb+lz896QT6C/ONgWE/SeHOMUZrYIHQ6e1LEE523aunzb0USlBW6XKeHYUB9UVYG+iTglXmB3cqHDvdJXdsieBth9n9s96HaO8RdHpAQF1DU47GXQp4kXMyLojB0aJ7pPy0GYP8d9iQhl7o/PMDY4nKKxyIYGVFUhVUP1IVUrJPdP36iutz+Gs/sk7qIo37J7e185+R68QtmZWfLkHeQgawRP+FpTDBGEWo96CDAApyRvqA0KZW5kc3RyZWFtDQplbmRvYmoNCjQzIDAgb2JqDQo8PC9CYXNlRm9udC9NeXJpYWRQcm8tQm9sZC9FbmNvZGluZy9XaW5BbnNpRW5jb2RpbmcvRmlyc3RDaGFyIDAvRm9udERlc2NyaXB0b3IgNDQgMCBSIC9MYXN0Q2hhciAyNTUvU3VidHlwZS9UeXBlMS9UeXBlL0ZvbnQvV2lkdGhzWyA1MDAgNTAwIDUwMCA1MDAgNTAwIDUwMCA1MDAgNTAwIDUwMCA1MDAgNTAwIDUwMCA1MDAgNTAwIDUwMCA1MDAgNTAwIDUwMCA1MDAgNTAwIDUwMCA1MDAgNTAwIDUwMCA1MDAgNTAwIDUwMCA1MDAgNTAwIDUwMCA1MDAgNTAwIDIwMiAyNjggMzk3IDU1MCA1NTUgODgwIDY3OCAyMDUgMzE0IDMxNCA0NTQgNTk2IDI2MCAzMjIgMjYwIDMzMSA1NTUgNTU1IDU1NSA1NTUgNTU1IDU1NSA1NTUgNTU1IDU1NSA1NTUgMjYwIDI2MCA1OTYgNTk2IDU5NiA0NDUgNzcwIDY1NiA2MDQgNTk1IDY5NiA1MzQgNTI3IDY4MiA2ODkgMjg1IDQxMSA2MTQgNTExIDg0NiA2OTAgNzE3IDU4MSA3MTcgNTkzIDU0MCA1NDggNjgyIDYzNiA4ODggNjEzIDYwMyA1NzcgMzE0IDMzMCAzMTQgNTk2IDUwMCAzMDAgNTI4IDU5OCA0NTEgNTk2IDUyOCAzNDEgNTg1IDU4NiAyNzQgMjkxIDU0MiAyNzUgODYwIDU4NiA1NzcgNTk4IDU5NSAzODAgNDM0IDM2NyA1ODMgNTMwIDc1OSA1MTkgNTIzIDQ2OSAzMTQgMjgzIDMxNCA1OTYgMzM4IDU1NSAzMzggMjYwIDU1NSA0NTkgMTAwMCA1MjQgNTI0IDMwMCAxMjg1IDU0MCAyNzAgOTM2IDMzOCA1NzcgMzM4IDMzOCAyNjAgMjYwIDQ1NCA0NTQgMzM4IDUwMCAxMDAwIDMwMCA2NTAgNDM0IDI3MCA4NjggMzM4IDQ2OSA2MDMgMjAyIDI2OCA1NTUgNTU1IDU1NSA1NTUgMjgzIDU2MSAzMDAgNjc3IDM3OCA0NjUgNTk2IDMyMiA0NTkgMzAwIDM1NiA1OTYgMzUyIDM0NyAzMDAgNTg1IDU0MiAyNjAgMzAwIDMwMCAzODYgNDY1IDgzMSA4MzEgODMxIDQ0NSA2NTYgNjU2IDY1NiA2NTYgNjU2IDY1NiA4NjggNTk1IDUzNCA1MzQgNTM0IDUzNCAyODUgMjg1IDI4NSAyODUgNzA0IDY5MCA3MTcgNzE3IDcxNyA3MTcgNzE3IDU5NiA3MTcgNjgyIDY4MiA2ODIgNjgyIDYwMyA1ODAgNjAwIDUyOCA1MjggNTI4IDUyOCA1MjggNTI4IDgwMyA0NTEgNTI4IDUyOCA1MjggNTI4IDI3NCAyNzQgMjc0IDI3NCA1NzQgNTg2IDU3NyA1NzcgNTc3IDU3NyA1NzcgNTk2IDU3NyA1ODMgNTgzIDU4MyA1ODMgNTIzIDU5OCA1MjNdPj4NCmVuZG9iag0KNDQgMCBvYmoNCjw8L0FzY2VudCA5ODkvQ2FwSGVpZ2h0IDY3NC9EZXNjZW50IC0yNTAvRmxhZ3MgMzIvRm9udEJCb3hbIC0xNjMgLTI1MCAxMjU2IDk4OV0vRm9udEZhbWlseShNeXJpYWQgUHJvKS9Gb250TmFtZS9NeXJpYWRQcm8tQm9sZC9Gb250U3RyZXRjaC9Ob3JtYWwvRm9udFdlaWdodCA3MDAvSXRhbGljQW5nbGUgMC9TdGVtViAxNTIvVHlwZS9Gb250RGVzY3JpcHRvci9YSGVpZ2h0IDQ4OT4+DQplbmRvYmoNCjQ1IDAgb2JqDQo8PC9CYXNlRm9udC9NeXJpYWRQcm8tUmVndWxhci9FbmNvZGluZy9XaW5BbnNpRW5jb2RpbmcvRmlyc3RDaGFyIDAvRm9udERlc2NyaXB0b3IgNDYgMCBSIC9MYXN0Q2hhciAyNTUvU3VidHlwZS9UeXBlMS9UeXBlL0ZvbnQvV2lkdGhzWyA1MDAgNTAwIDUwMCA1MDAgNTAwIDUwMCA1MDAgNTAwIDUwMCA1MDAgNTAwIDUwMCA1MDAgNTAwIDUwMCA1MDAgNTAwIDUwMCA1MDAgNTAwIDUwMCA1MDAgNTAwIDUwMCA1MDAgNTAwIDUwMCA1MDAgNTAwIDUwMCA1MDAgNTAwIDIxMiAyMzAgMzM3IDQ5NyA1MTMgNzkyIDYwNSAxODggMjg0IDI4NCA0MTUgNTk2IDIwNyAzMDcgMjA3IDM0MyA1MTMgNTEzIDUxMyA1MTMgNTEzIDUxMyA1MTMgNTEzIDUxMyA1MTMgMjA3IDIwNyA1OTYgNTk2IDU5NiA0MDYgNzM3IDYxMiA1NDIgNTgwIDY2NiA0OTIgNDg3IDY0NiA2NTIgMjM5IDM3MCA1NDIgNDcyIDgwNCA2NTggNjg5IDUzMiA2ODkgNTM4IDQ5MyA0OTcgNjQ3IDU1OCA4NDYgNTcxIDU0MSA1NTMgMjg0IDM0MSAyODQgNTk2IDUwMCAzMDAgNDgyIDU2OSA0NDggNTY0IDUwMSAyOTIgNTU5IDU1NSAyMzQgMjQzIDQ2OSAyMzYgODM0IDU1NSA1NDkgNTY5IDU2MyAzMjcgMzk2IDMzMSA1NTEgNDgxIDczNiA0NjMgNDcxIDQyOCAyODQgMjM5IDI4NCA1OTYgMjgyIDUxMyAyODIgMjA3IDUxMyAzNTYgMTAwMCA1MDAgNTAwIDMwMCAxMTU2IDQ5MyAyNTUgODk0IDI4MiA1NTMgMjgyIDI4MiAyMDcgMjA3IDM1NCAzNTQgMjgyIDUwMCAxMDAwIDMwMCA2MTkgMzk2IDI1NSA4NjMgMjgyIDQyOCA1NDEgMjEyIDIzMCA1MTMgNTEzIDUxMyA1MTMgMjM5IDUxOSAzMDAgNjc3IDM0NiA0MTkgNTk2IDMwNyA0MTkgMzAwIDMxOCA1OTYgMzExIDMwNSAzMDAgNTUzIDUxMiAyMDcgMzAwIDI0NCAzNTUgNDE5IDc1OSA3NTkgNzU5IDQwNiA2MTIgNjEyIDYxMiA2MTIgNjEyIDYxMiA3ODggNTgwIDQ5MiA0OTIgNDkyIDQ5MiAyMzkgMjM5IDIzOSAyMzkgNjcxIDY1OCA2ODkgNjg5IDY4OSA2ODkgNjg5IDU5NiA2ODkgNjQ3IDY0NyA2NDcgNjQ3IDU0MSA1MzEgNTQ4IDQ4MiA0ODIgNDgyIDQ4MiA0ODIgNDgyIDc3MyA0NDggNTAxIDUwMSA1MDEgNTAxIDIzNCAyMzQgMjM0IDIzNCA1NDEgNTU1IDU0OSA1NDkgNTQ5IDU0OSA1NDkgNTk2IDU0OSA1NTEgNTUxIDU1MSA1NTEgNDcxIDU2OSA0NzFdPj4NCmVuZG9iag0KNDYgMCBvYmoNCjw8L0FzY2VudCA5NTIvQ2FwSGVpZ2h0IDY3NC9EZXNjZW50IC0yNTAvRmxhZ3MgMzIvRm9udEJCb3hbIC0xNTcgLTI1MCAxMTI2IDk1Ml0vRm9udEZhbWlseShNeXJpYWQgUHJvKS9Gb250TmFtZS9NeXJpYWRQcm8tUmVndWxhci9Gb250U3RyZXRjaC9Ob3JtYWwvRm9udFdlaWdodCA0MDAvSXRhbGljQW5nbGUgMC9TdGVtViA4OC9UeXBlL0ZvbnREZXNjcmlwdG9yL1hIZWlnaHQgNDg0Pj4NCmVuZG9iag0KNDcgMCBvYmoNCjw8L0JpdHNQZXJDb21wb25lbnQgOC9Db2xvclNwYWNlL0RldmljZVJHQi9EZWNvZGVbIDAgMSAwIDEgMCAxXS9GaWx0ZXIvRmxhdGVEZWNvZGUvSGVpZ2h0IDE1MC9MZW5ndGggMjM4NzIvU01hc2sgNDggMCBSIC9TdWJ0eXBlL0ltYWdlL1R5cGUvWE9iamVjdC9XaWR0aCA0MjA+PnN0cmVhbQ0KSInsV91vFNcV/zca70e1sx+2K/WhpBKOVERpBSiKgtRgFxOIqtKqFQ9VcUvcp1aoqG/YQMhbQtW81ZjCW9KGSn0Bm5q3gpWH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MDAwIG4NCjAwMDAwMDU0NzkgMDAwMDAgbg0KMDAwMDAwNTYyMiAwMDAwMCBuDQowMDAwMDA1NjUyIDAwMDAwIG4NCjAwMDAwMDYyMTggMDAwMDAgbg0KMDAwMDAwNjI5MCAwMDAwMCBuDQowMDAwMDA2NTcwIDAwMDAwIG4NCjAwMDAwMDY2ODAgMDAwMDAgbg0KMDAwMDAxMzUwMiAwMDAwMCBuDQowMDAwMDE0MDkyIDAwMDAwIG4NCjAwMDAwMTQyMzMgMDAwMDAgbg0KMDAwMDAxNDI2MyAwMDAwMCBuDQowMDAwMDE0NDIzIDAwMDAwIG4NCjAwMDAwMTQ0OTUgMDAwMDAgbg0KMDAwMDAxNDc3MiAwMDAwMCBuDQowMDAwMDE0ODU2IDAwMDAwIG4NCjAwMDAwMTU0NzkgMDAwMDAgbg0KMDAwMDAxNTc5MCAwMDAwMCBuDQowMDAwMDE1OTM2IDAwMDAwIG4NCjAwMDAwMTU5NjYgMDAwMDAgbg0KMDAwMDAxNjYwMSAwMDAwMCBuDQowMDAwMDE2NjczIDAwMDAwIG4NCjAwMDAwMTY5NTYgMDAwMDAgbg0KMDAwMDAxNzA3MiAwMDAwMCBuDQowMDAwMDI1MjUzIDAwMDAwIG4NCjAwMDAwMjU4ODcgMDAwMDAgbg0KMDAwMDAyNjAzMSAwMDAwMCBuDQowMDAwMDI2MDYxIDAwMDAwIG4NCjAwMDAwMjYyMTYgMDAwMDAgbg0KMDAwMDAyNjI4OCAwMDAwMCBuDQowMDAwMDI2NTY3IDAwMDAwIG4NCjAwMDAwMjY2NTEgMDAwMDAgbg0KMDAwMDAyNzIwNyAwMDAwMCBuDQowMDAwMDI3NTA4IDAwMDAwIG4NCjAwMDAwMjg2ODkgMDAwMDAgbg0KMDAwMDAyODkyNyAwMDAwMCBuDQowMDAwMDMwMTExIDAwMDAwIG4NCjAwMDAwMzAzNTEgMDAwMDAgbg0KMDAwMDA1NDQyMSAwMDAwMCBuDQowMDAwMDU0Njg4IDAwMDAwIG4NCjAwMDAwNzQyODggMDAwMDAgbg0KMDAwMDA3NDU1OCAwMDAwMCBuDQowMDAwMDc1MjEyIDAwMDAwIG4NCjAwMDAwNzU2OTUgMDAwMDAgbg0KMDAwMDA3ODkxNSAwMDAwMCBuDQowMDAwMDc5Mzk4IDAwMDAwIG4NCjAwMDAwODE1NjYgMDAwMDAgbg0KMDAwMDA4MTY0NSAwMDAwMCBuDQp0cmFpbGVyDQo8PA0KL1Jvb3QgMSAwIFINCi9JbmZvIDMgMCBSDQovU2l6ZSA1OC9JRFs8QThGMzlEODZEMzQ2Qjk3Qjk4QTMyRjc5QzU0NjQ5MTk+PEE4RjM5RDg2RDM0NkI5N0I5OEEzMkY3OUM1NDY0OTE5Pl0+Pg0Kc3RhcnR4cmVmDQo4MTY3NQ0KJSVFT0YNCg=="; // your base64 string
    //this.printBase64PDF(base64PDF);
    this.onShowPDFSEPP(base64PDF);
},
   printBase64PDF: function(base64Data) {
    try {
        // Strip prefix if present
        if (base64Data.startsWith("data:")) {
            base64Data = base64Data.split(",")[1];
        }

        // Decode base64 string
        const byteCharacters = atob(base64Data);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
            byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);

        // Create blob from byteArray
        const blob = new Blob([byteArray], { type: "application/pdf" });
        const blobUrl = URL.createObjectURL(blob);

        // Create an invisible iframe
        const iframe = document.createElement("iframe");
        iframe.style.position = "absolute";
        iframe.style.left = "-9999px";
        iframe.src = blobUrl;

        document.body.appendChild(iframe);

        iframe.onload = function () {
            console.log("✅ PDF loaded. Triggering print...");
            iframe.contentWindow.focus();
            iframe.contentWindow.print();

            // Cleanup after printing
            setTimeout(function () {
                URL.revokeObjectURL(blobUrl);
                document.body.removeChild(iframe);
            }, 1000);
        };
    } catch (error) {
        console.error("❌ Error during print process:", error);
    }
},
 onShowPDFSEPP: function(base64Content) {

            var byteCharacters = atob(base64Content);
            var byteNumbers = new Array(byteCharacters.length);

            for (var i = 0; i < byteCharacters.length; i++) {
                byteNumbers[i] = byteCharacters.charCodeAt(i);
            }

            var byteArray = new Uint8Array(byteNumbers);


            var blob = new Blob([byteArray], {
                type: 'application/pdf'
            });


            var pdfUrl = URL.createObjectURL(blob);

            var oHtmlControl = this._pAddRecordDialog.getContent()[0].getAggregation("items")[2].getAggregation("items")[0];
            var iframeContent = '<iframe id="pdfFrames" src="' + pdfUrl + '" title="Invoice" width="80%" height="550px"></iframe>';
            oHtmlControl.setContent(iframeContent);
            this._pAddRecordDialog.getContent()[0].getAggregation("items")[2].getAggregation("items")[0].setVisible(true);

        },

            openPlanet: function (url, bflag, transID) {
                var that = this;
                var wind = window.open(url, "_blank");
                that.oModel.read("/PlanetTagSet('" + transID + "')", {
                    success: function (oData) {

                        that.getView().setBusy(false);
                        if (that._oDialogPayment) {
                            that._oDialogPayment.setBusy(false);
                        }
                        that._pAddRecordDialog.setBusy(false);

                        MessageBox.success("Transaction Posted Successfully.", {
                            onClose: function (sAction) {
                                window.location.reload(true);
                            }
                        });
                        if (!bflag) {
                            window.location.reload(true);
                        }







                    },
                    error: function (oError) {

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
                            that.onOpenSignaturePad();
                            //that.OnSignaturePress();
                            // that.onPressPaymentTest();
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
                        // this.aPaymentEntries.forEach(function (entry) {
                        //     if (entry.PaymentType === "CASH") {
                        //         entry.ChangeAmount = balanceAmount.toString();
                        //     }
                        // });
                        for (var i = this.aPaymentEntries.length - 1; i >= 0; i--) {
                            if (this.aPaymentEntries[i].PaymentType === "CASH") {
                                this.aPaymentEntries[i].ChangeAmount = balanceAmount.toString();
                                break; // Stop after updating the last CASH entry
                            }
                        }
                        oEvent.getSource().setEnabled(false);
                        sap.m.MessageToast.show("Cash Payment Successful");
                        that.onOpenSignaturePad();
                        //that.OnSignaturePress();
                        //that.onPressPaymentTest();
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
                        }).addStyleClass("cstmBtn"),
                        endButton: new sap.m.Button({
                            text: "Cancel",
                            class: "cstmBtn",
                            press: function () {
                                this._oDialogCardType.close();
                            }.bind(this)
                        }).addStyleClass("cstmBtn")
                    }).addStyleClass("customerDialog");
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
                    that.onOpenSignaturePad();
                    // that.OnSignaturePress();
                    //that.onPressPaymentTest();
                }
                else {
                    sap.ui.getCore().byId("totalSaleBalText").setText(parseFloat(Math.abs(balanceAmount)).toFixed(2));
                    sap.ui.getCore().byId("cash").setValue("");
                    sap.ui.getCore().byId("sbmtTrans").setVisible(false);
                    sap.m.MessageToast.show("Manual Card Payment Successful");
                }
                this._oDialogCardType.close();

            },
            onRedeemBounze: function (oEvent) {
                var oSelectedItem = that.getView().getModel("BounzeModel").getData();

                if (oSelectedItem.PointBalance === "0" && oSelectedItem.AccountStatus === "inactive") {
                    sap.m.MessageBox.error("Kindly make sure account should be active and have Points to redeem");
                }
                else {
                    this.onOpenRedeemDialog();
                }
            },
            onOpenRedeemDialog: function () {
                if (!this._oRedeemDialog) {
                    // Create the dialog only once
                    this._oRedeemDialog = new sap.m.Dialog({
                        title: "Redeem Points",
                        contentWidth: "300px",
                        contentHeight: "300px",
                        content: [
                            new sap.m.VBox({
                                items: [

                                    new sap.m.Input("idPointsInput", {
                                        type: sap.m.InputType.Number,
                                        width: "80%",
                                        placeholder: "Enter Points to Redeem",
                                        liveChange: this.onPointsLiveChange.bind(this)
                                    }).addStyleClass("sapUiSmallMarginBegin  sapUiSmallMarginTop sapUiSmallMarginBottom inputStyle"),

                                    new sap.m.Label("lblRedeemedAmt", { text: "Redeemed Amount", visible: false, design: "Bold" }).addStyleClass("sapUiSmallMarginBegin cashierLogin sapUiSmallMarginTop "),
                                    new sap.m.Input("inpRedeemedAmt", {
                                        visible: false,
                                        editable: false,
                                        width: "80%",
                                    }).addStyleClass("sapUiSmallMarginBegin  sapUiSmallMarginTop sapUiSmallMarginBottom inputStyle"),

                                    new sap.m.Label("idOTPLabel", { text: "Enter OTP", visible: false, design: "Bold" }).addStyleClass("sapUiSmallMarginBegin cashierLogin sapUiSmallMarginTop "),
                                    new sap.m.Input("idOTPInput", {
                                        placeholder: "Enter OTP",
                                        visible: false,
                                        liveChange: this.onEnableSubmitBtn.bind(this),
                                        width: "80%",
                                    }).addStyleClass("sapUiSmallMarginBegin  sapUiSmallMarginTop sapUiSmallMarginBottom inputStyle")
                                ]
                            })
                        ],
                        buttons: [
                            new sap.m.Button("redeemBtn", {
                                text: "Redeem",
                                enabled: false,
                                visible: true,
                                press: this.onRedeemPoints.bind(this)
                            }).addStyleClass("cstmBtn"),
                            new sap.m.Button("idSubmitBtn", {
                                text: "Submit",
                                visible: false,
                                press: this.onSubmitOTP.bind(this)
                            }).addStyleClass("cstmBtn"),
                            new sap.m.Button({
                                text: "Close",
                                press: function () {
                                    this._oRedeemDialog.close();
                                }.bind(this)
                            }).addStyleClass("cstmBtn")
                        ]
                    });

                    this.getView().addDependent(this._oRedeemDialog);
                }

                this._oRedeemDialog.open();
            },
            onPointsLiveChange: function (oEvent) {
                var sValue = oEvent.getParameter("value");
                var oRedeemBtn = sap.ui.getCore().byId("redeemBtn");

                // Check if value is a positive number
                var bEnable = /^\d+$/.test(sValue) && parseInt(sValue) > 0;
                oRedeemBtn.setEnabled(bEnable);
            },
            onEnableSubmitBtn: function (oEvent) {
                sap.ui.getCore().byId("idSubmitBtn").setVisible(true);
            },
            onRedeemPoints: function () {
                var that = this;
                let sPoints = sap.ui.getCore().byId("idPointsInput").getValue();
                var oSelectedItem = that.getView().getModel("BounzeModel").getData();

                if (parseInt(sPoints) > parseInt(oSelectedItem.PointBalance)) {
                    sap.m.MessageToast.show("Entered Points should be equal or less than Point balance");
                    return;
                }

                var data = {
                    "MobileNumber": this.getView().getModel("custAddModel").getData().Mobile,
                    "CountryCode": this.getView().getModel("custAddModel").getData().Code,
                    "StoreId": that.storeID,
                    "Points": parseInt(sPoints).toString(),
                    "Amount": "0.00",
                    "LockPointId": ""
                }

                this.oModel.create("/BounzLockPointSet", data, {
                    success: function (oData, response) {
                        that.point = oData.Points;
                        that.lockId = oData.LockPointId;
                        that.redeemAmount = oData.Amount;
                        sap.ui.getCore().byId("idOTPInput").setVisible(true);
                        sap.ui.getCore().byId("idOTPLabel").setVisible(true);
                        sap.ui.getCore().byId("redeemBtn").setVisible(false);
                        sap.ui.getCore().byId("lblRedeemedAmt").setVisible(true);
                        sap.ui.getCore().byId("inpRedeemedAmt").setValue(that.redeemAmount);
                        sap.ui.getCore().byId("inpRedeemedAmt").setVisible(true);


                        sap.m.MessageToast.show("OTP sent to your registered mobile.");
                    },
                    error: function (oError) {
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

            onSubmitOTP: function () {
                var that = this;
                let sOTP = sap.ui.getCore().byId("idOTPInput").getValue();

                var data = {
                    "MobileNumber": this.getView().getModel("custAddModel").getData().Mobile,
                    "CountryCode": this.getView().getModel("custAddModel").getData().Code,
                    "Otp": sOTP,
                    "StoreId": that.storeID,
                    "InvoiceNumber": that.getView().byId("tranNumber").getCount().toString(),
                    "Points": that.point,
                    "Amount": that.redeemAmount,
                    "LockId": that.lockId,
                    "TransactionId": that.getView().byId("tranNumber").getCount().toString()
                }

                this.oModel.create("/BounzRedemptionSet", data, {
                    success: function (oData, response) {
                        that.paymentId = that.paymentId + 1;
                       
                        that.aPaymentEntries.push({
                            "TransactionId": that.getView().byId("tranNumber").getCount().toString(),
                            "PaymentId": that.paymentId.toString(),
                            "PaymentDate": new Date(),
                            "Amount": that.redeemAmount,
                            "Currency": "AED",
                            "PaymentMethod": "044",
                            "PaymentMethodName": "Bounz Points Redemption",
                            "Tid": "",
                            "Mid": "",
                            "CardType": "",
                            "CardLabel": "",
                            "CardNumber": "",
                            "AuthorizationCode": "",
                            "CardReceiptNo": "",
                            "PaymentType": "BOUNZ",
                            "VoucherNumber": "",
                            "SourceId": "",
                            "ChangeAmount": "0.00"


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

                            that.onOpenSignaturePad();
                            //that.OnSignaturePress();
                            // that.onPressPaymentTest();
                        }
                        else {
                            sap.ui.getCore().byId("totalSaleBalText").setText(parseFloat(Math.abs(balanceAmount)).toFixed(2));
                           
                            sap.ui.getCore().byId("sbmtTrans").setVisible(false);
                        }
                        if (that._oRedeemDialog) {
                            that._oRedeemDialog.close();
                        }
                        sap.m.MessageToast.show("Redeemed Succeessfully");

                    },
                    error: function (oError) {
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
                        }).addStyleClass("cstmBtn"),
                        endButton: new sap.m.Button({
                            text: "Cancel",
                            class: "cstmBtn",
                            press: function () {
                                this._oDialogNonGV.close();
                            }.bind(this)
                        }).addStyleClass("cstmBtn")
                    }).addStyleClass("customerDialog");
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
                    that.onOpenSignaturePad();
                    //that.OnSignaturePress();
                    //that.onPressPaymentTest();
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
                            that.getMaterialDetail(true, mResult.text, "");
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
            onFetchBounzeDetails: function () {
                var that = this;
                var oModel = new JSONModel();
                that.bcode = this.getView().getModel("custAddModel").getData().Code;
                that.bphnNumber = this.getView().getModel("custAddModel").getData().Mobile;
                this.oModel.read("/BounzMemberProfileSet(MobileNumber='" + that.bphnNumber + "',CountryCode='" + that.bcode + "')", {
                    success: function (oData) {

                        oModel.setData(oData);
                        that.getView().setModel(oModel, "BounzeModel");
                        sap.ui.getCore().byId("bounzeDetails").setVisible(true);



                    },
                    error: function (oError) {

                        sap.ui.getCore().byId("bounzeDetails").setVisible(false);
                        sap.m.MessageBox.show(JSON.parse(oError.responseText).error.message.value, {
                            icon: sap.m.MessageBox.Icon.Error,
                            title: "Error",
                            actions: [MessageBox.Action.OK],
                            onClose: function (oAction) {
                                if (JSON.parse(oError.responseText).error.message.value === "Member profile not found") {
                                    sap.ui.getCore().byId("registerBounz").setEnabled(true);
                                }
                            }
                        });
                    }
                });
            },
            onBounzRegister: function () {
                var that = this;
                var data = {
                    "MobileNumber": this.getView().getModel("custAddModel").getData().Mobile,
                    "CountryCode": this.getView().getModel("custAddModel").getData().Code,
                    "FirstName": this.getView().getModel("custAddModel").getData().FirstName,
                    "LastName": this.getView().getModel("custAddModel").getData().LastName,
                    "Email": this.getView().getModel("custAddModel").getData().Email,
                    "Dob": "",
                    "StoreId": that.storeID,
                    "Eid": that.cashierID
                }
                var birthDate = sap.ui.getCore().byId("birthDate").getValue();
                if (birthDate) {

                    data.Dob = new Date(this.resolveTimeDifference(new Date(birthDate)));
                }
                else {
                    data.Dob = null;
                }
                this.oModel.create("/BounzRegistrationSet", data, {
                    success: function (oData, response) {

                        sap.m.MessageBox.success("Member Registered Successfully");
                    },
                    error: function (oError) {
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
                            that.redeemVoucher(that.paymentId, "030", "Credit Memo", "CREDIT NOTE", balanceAmount, "CreditNote");
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
                            that.redeemVoucher(that.paymentId, "030", "On-Account Receipt", "ADVANCE PAYMENT", balanceAmount, "AdvancePayment");
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
                        if (paymentType1 === "CREDIT NOTE") {
                            that.updateBalanceAmount("Credit Voucher", "CreditNote");

                        }
                        if (paymentType1 === "ADVANCE PAYMENT") {
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
                var sSanitized = sRawValue.replace(/[^0-9.]/g, ""); // Allow only digits
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
                    that.onOpenSignaturePad();
                    //that.OnSignaturePress();
                    //that.onPressPaymentTest();
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
            },
            // onSave: function () {
            //     var that = this,
            //         token,
            //         dataUrl,
            //         oSvg = sap.ui.core.Fragment.byId(this.getView().getId(), "idSignaturePad").getSVGString(),
            //         oSvgCash = sap.ui.core.Fragment.byId(this.getView().getId(), "idSignaturePadCash").getSVGString();
            //     this.oPaySignatureload = [];
            //     // oName = sap.ui.core.Fragment.byId(this.getView().getId(), "idName").getValue(),
            //     // oStaff = sap.ui.core.Fragment.byId(this.getView().getId(), "idStaff").getValue(),
            //     // oComments = sap.ui.core.Fragment.byId(this.getView().getId(), "idComments").getValue();

            //     if (!oSvg.includes('d=') || !oSvgCash.includes('d=')) {
            //         MessageBox.error('Signature is required');
            //         return false;
            //     }
            //     const svgBlob = new Blob([oSvg], {
            //         type: 'image/svg+xml'
            //     });
            //     const svgObjectUrl = globalThis.URL.createObjectURL(svgBlob);
            //     const img = document.createElement('img');

            //     const onImageLoaded = () => {
            //         const canvas = document.createElement('canvas');
            //         //canvas.width="350";
            //         //canvas.height="100";
            //         const context = canvas.getContext('2d');
            //         const createdImage = document.createElement('img');

            //         context.drawImage(img, 0, 0);
            //         createdImage.src = canvas.toDataURL('image/bmp');
            //         //binary code
            //         var oArray = (createdImage.src).split(";base64,")[1];
            //         var raw = window.atob(oArray);
            //         var rawLength = raw.length;
            //         var array = new Uint8Array(new ArrayBuffer(rawLength));
            //         for (var i = 0; i < rawLength; i++) {
            //             array[i] = raw.charCodeAt(i);
            //         }

            //         this.oPaySignatureload.push({
            //             "TransactionId": this.getView().byId("tranNumber").getCount(),
            //             "Value": oArray,
            //             "Mimetype": 'image/bmp',
            //             "SignType": "S"
            //         })


            //     };

            //     img.addEventListener('load', onImageLoaded);
            //     img.src = svgObjectUrl;



            //     const svgBlobCash = new Blob([oSvgCash], {
            //         type: 'image/svg+xml'
            //     });
            //     const svgObjectUrlCash = globalThis.URL.createObjectURL(svgBlobCash);
            //     const imgCash = document.createElement('img');

            //     const onImageLoadedCash = () => {
            //         const canvasCash = document.createElement('canvas');
            //         //canvas.width="350";
            //         //canvas.height="100";
            //         const contextCash = canvasCash.getContext('2d');
            //         const createdImageCash = document.createElement('img');

            //         contextCash.drawImage(imgCash, 0, 0);
            //         createdImageCash.src = canvasCash.toDataURL('image/bmp');
            //         //binary code
            //         var oArrayCash = (createdImageCash.src).split(";base64,")[1];
            //         var rawCash = window.atob(oArrayCash);
            //         var rawLengthCash = rawCash.length;
            //         var arrayCash = new Uint8Array(new ArrayBuffer(rawLengthCash));
            //         for (var j = 0; j < rawLengthCash; j++) {
            //             arrayCash[j] = rawCash.charCodeAt(j);
            //         }

            //         this.oPaySignatureload.push({
            //             "TransactionId": this.getView().byId("tranNumber").getCount(),
            //             "Value": oArrayCash,
            //             "Mimetype": 'image/bmp',
            //             "SignType": "C"
            //         })


            //     };

            //     imgCash.addEventListener('load', onImageLoadedCash);
            //     imgCash.src = svgObjectUrlCash;
            //     that._pAddRecordDialog.then(
            //         function (oValueHelpDialog) {
            //             that.onClear();
            //             oValueHelpDialog.setBusy(true);
            //         }.bind(that)
            //     );
            //     setTimeout(function () {
            //         that.onPressPayment(true);
            //     }, 1000)


            // }
            onSave: function () {
                var that = this;
                this.oPaySignatureload = [];
                var oSvg = sap.ui.core.Fragment.byId(this.getView().getId(), "idSignaturePad").getSignature(),
                    oSvgCash = sap.ui.core.Fragment.byId(this.getView().getId(), "idSignaturePadCash").getSignature();

                this.oPaySignatureload.push({
                    "TransactionId": this.getView().byId("tranNumber").getCount(),
                    "Value": oSvg.split("data:image/png;base64,")[1],
                    "Mimetype": 'image/png',
                    "SignType": "S"
                })

                this.oPaySignatureload.push({
                    "TransactionId": this.getView().byId("tranNumber").getCount(),
                    "Value": oSvgCash.split("data:image/png;base64,")[1],
                    "Mimetype": 'image/png',
                    "SignType": "C"
                })

                that._pAddRecordDialog.then(
                    function (oValueHelpDialog) {
                        oValueHelpDialog.setBusy(true);
                    }.bind(that)
                );
                setTimeout(function () {
                    that.onPressPayment(true);
                }, 1000)

            },
            onClearSignature: function () {
                const oCanvasControl = sap.ui.core.Fragment.byId("SignaturePad", "signatureCanvas");
                const canvas = oCanvasControl.getDomRef();
                const ctx = canvas.getContext("2d");
                ctx.clearRect(0, 0, canvas.width, canvas.height);

                const oCanvasControl1 = sap.ui.core.Fragment.byId("SignaturePad", "signatureCanvas1");
                const canvas1 = oCanvasControl1.getDomRef();
                const ctx1 = canvas1.getContext("2d");
                ctx1.clearRect(0, 0, canvas1.width, canvas1.height);
            },

            onSaveSignature: function () {
                var that = this;
                this.oPaySignatureload = [];
                const oCanvasControl = sap.ui.core.Fragment.byId("SignaturePad", "signatureCanvas");
                const canvas = oCanvasControl.getDomRef();
                const imageData = canvas.toDataURL("image/png"); // base64 format
                // You can now send this to backend or store it
                console.log("Signature Base64:", imageData);

                const oCanvasControl1 = sap.ui.core.Fragment.byId("SignaturePad", "signatureCanvas1");
                const canvas1 = oCanvasControl1.getDomRef();
                const imageData1 = canvas1.toDataURL("image/png"); // base64 format
                // You can now send this to backend or store it
                console.log("Signature Base64:", imageData1);

                this.oPaySignatureload.push({
                    "TransactionId": this.getView().byId("tranNumber").getCount(),
                    "Value": imageData.split("data:image/png;base64,")[1],
                    "Mimetype": 'image/png',
                    "SignType": "S"
                })

                this.oPaySignatureload.push({
                    "TransactionId": this.getView().byId("tranNumber").getCount(),
                    "Value": imageData1.split("data:image/png;base64,")[1],
                    "Mimetype": 'image/png',
                    "SignType": "C"
                })


                that._pAddRecordDialog.setBusy(true);
                setTimeout(function () {
                    that.onPressPayment(true);
                }, 1000)
            },
            getEventPosition: function (e, canvas) {
                let x, y;
                if (e.touches && e.touches.length > 0) {
                    x = e.touches[0].clientX - canvas.getBoundingClientRect().left;
                    y = e.touches[0].clientY - canvas.getBoundingClientRect().top;
                } else {
                    x = e.clientX - canvas.getBoundingClientRect().left;
                    y = e.clientY - canvas.getBoundingClientRect().top;
                }
                return {
                    x,
                    y
                };
            },
            _initializeCanvas: function () {
                this._initializeCanvas1();
                this._initializeCanvas2();
            },
            _initializeCanvas1: function () {
                const oCanvasControl = sap.ui.core.Fragment.byId("SignaturePad", "signatureCanvas");
                if (!oCanvasControl) {
                    console.error("Canvas control not found");
                    return;
                }

                const canvas = oCanvasControl.getDomRef(); // Get actual <canvas> DOM element
                if (!canvas || !canvas.getContext) {
                    console.error("Canvas DOM element not ready or invalid");
                    return;
                }

                const ctx = canvas.getContext("2d");
                let isDrawing = false;

                const getEventPosition = (e) => {
                    let x, y;
                    if (e.touches && e.touches.length > 0) {
                        x = e.touches[0].clientX - canvas.getBoundingClientRect().left;
                        y = e.touches[0].clientY - canvas.getBoundingClientRect().top;
                    } else {
                        x = e.clientX - canvas.getBoundingClientRect().left;
                        y = e.clientY - canvas.getBoundingClientRect().top;
                    }
                    return {
                        x,
                        y
                    };
                };

                const start = (e) => {
                    isDrawing = true;
                    ctx.beginPath();
                    const pos = getEventPosition(e);
                    ctx.moveTo(pos.x, pos.y);
                    e.preventDefault();
                };

                const draw = (e) => {
                    if (!isDrawing) return;
                    const pos = getEventPosition(e);
                    ctx.lineTo(pos.x, pos.y);
                    ctx.stroke();
                    e.preventDefault();
                };

                const end = () => {
                    isDrawing = false;
                };

                canvas.addEventListener("mousedown", start);
                canvas.addEventListener("mousemove", draw);
                canvas.addEventListener("mouseup", end);
                canvas.addEventListener("mouseout", end);

                canvas.addEventListener("touchstart", start, {
                    passive: false
                });
                canvas.addEventListener("touchmove", draw, {
                    passive: false
                });
                canvas.addEventListener("touchend", end);
            },
            _initializeCanvas2: function () {
                const oCanvasControl = sap.ui.core.Fragment.byId("SignaturePad", "signatureCanvas1");
                if (!oCanvasControl) {
                    console.error("Canvas control not found");
                    return;
                }

                const canvas = oCanvasControl.getDomRef(); // Get actual <canvas> DOM element
                if (!canvas || !canvas.getContext) {
                    console.error("Canvas DOM element not ready or invalid");
                    return;
                }

                const ctx = canvas.getContext("2d");
                let isDrawing = false;

                const getEventPosition = (e) => {
                    let x, y;
                    if (e.touches && e.touches.length > 0) {
                        x = e.touches[0].clientX - canvas.getBoundingClientRect().left;
                        y = e.touches[0].clientY - canvas.getBoundingClientRect().top;
                    } else {
                        x = e.clientX - canvas.getBoundingClientRect().left;
                        y = e.clientY - canvas.getBoundingClientRect().top;
                    }
                    return {
                        x,
                        y
                    };
                };

                const start = (e) => {
                    isDrawing = true;
                    ctx.beginPath();
                    const pos = getEventPosition(e);
                    ctx.moveTo(pos.x, pos.y);
                    e.preventDefault();
                };

                const draw = (e) => {
                    if (!isDrawing) return;
                    const pos = getEventPosition(e);
                    ctx.lineTo(pos.x, pos.y);
                    ctx.stroke();
                    e.preventDefault();
                };

                const end = () => {
                    isDrawing = false;
                };

                canvas.addEventListener("mousedown", start);
                canvas.addEventListener("mousemove", draw);
                canvas.addEventListener("mouseup", end);
                canvas.addEventListener("mouseout", end);

                canvas.addEventListener("touchstart", start, {
                    passive: false
                });
                canvas.addEventListener("touchmove", draw, {
                    passive: false
                });
                canvas.addEventListener("touchend", end);
            },
            onOpenSignaturePad: function () {
                if (!this._pAddRecordDialog) {
                    const oContent = sap.ui.xmlfragment(
                        "SignaturePad",
                        "com.eros.salesprocess.fragment.SignaturePads",
                        this
                    );

                    this._pAddRecordDialog = new sap.m.Dialog({
                        title: "Signature Pad",
                        content: [oContent],
                        stretch: true,
                        afterOpen: this._initializeCanvas.bind(this),

                    });

                    this.getView().addDependent(this._pAddRecordDialog);
                }
                this._pAddRecordDialog.open();
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

            }


        });
    });

